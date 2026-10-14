import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../../flows/bkA2-chain.flows';

// NJM-154698: "[MSSQL-BK-General-0006] Verify Recovery Point Validity" (every recovery point is part of a restorable chain).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model, so a Log backup is possible), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154698 (deleted in afterEach, backups kept); runs one Full, one Differential and one Log backup.
// case-vs-ui: the UI has no "valid / usable for recovery" flag per recovery point. Validity is shown as: the recovery picker (Recover on the job page) lists the points with no
//   corrupt / invalid / missing text and a point can be selected (UNVERIFIED locators, see pages/bkA2-recovery.page.ts), and the msdb chain is complete (diff -> full, log -> full).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154698');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO keeps every Full, Differential and Log recovery point of a chain valid and selectable for recovery', { tag: '@NJM-154698' }, async ({ signedIn: _s, page, backupFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const msdb = new MsdbChain(host, db);
  const chain = new ChainFlows(page, backupFlows);
  const mark = { value: 0 };

  await test.step('1. Precondition: the database is FULL-recovery and the repository is selectable', async () => {
    const model = await host.recoveryModel(db);
    if (model !== 'FULL') throw new Error(`ABORTED: database ${db} is in ${model || 'an unknown'} recovery model, the case needs FULL`);
    mark.value = await msdb.watermark();
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('2. Run the job: a Full recovery point is created', async () => {
    expect(await chain.runAndWait()).toBe('successful');
  });

  await test.step('3. Run Differential, then Log: both recovery points are created in sequence', async () => {
    expect(await chain.runAndWait({ type: 'Differential' })).toBe('successful');
    expect(await chain.runAndWait({ type: 'Log' })).toBe('successful');
  });

  await test.step('4. Open the recovery-point list: three points are listed and none is flagged invalid', async () => {
    const texts = await chain.openRecoveryPicker();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery picker texts: ${texts.slice(0, 80).join(' | ')}` });
    expect(texts.join(' ')).not.toMatch(/corrupt|invalid|missing|broken/i);
    await expect(chain.recovery.pointRows()).not.toHaveCount(0);
  });

  await test.step('5. Select a recovery point: it is accepted with no validity error; the chain in msdb is complete', async () => {
    await chain.recovery.pointRow('Log').click({ timeout: 10_000 });
    expect((await backupFlows.visibleTexts()).join(' ')).not.toMatch(/corrupt|invalid|missing|broken/i);
    await chain.closeRecovery();
    const sets = await msdb.since(mark.value);
    const full = sets.find((b) => b.type === 'D');
    const diff = sets.find((b) => b.type === 'I');
    const log = sets.find((b) => b.type === 'L');
    expect(full && diff && log, 'msdb should hold a Full, a Differential and a Log set from the three runs').toBeTruthy();
    expect(diff!.differentialBaseGuid).toBe(full!.uuid);
    expect(log!.databaseBackupLsn).toBe(full!.checkpointLsn);
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'No per-point validity flag exists in the UI; the msdb chain links and the absence of error text are checked.' });
  });
});
