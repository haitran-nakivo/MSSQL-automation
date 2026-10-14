import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154679: "[MSSQL-BK-Chain-0006] Verify Display of Restore Points" (the UI lists a timestamp per recovery point).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154679 (deleted in afterEach, backups kept); runs one Full, one Differential and one Log backup.
// case-vs-ui: the case opens "Configuration > Repositories > Recovery Points"; the recovery points are listed by the Recover wizard of the job page (Recover > Full recovery for individual database >
//   picker). UNVERIFIED: that path and the picker's rows (see pages/bkA2-recovery.page.ts). A recovery point is expected to show a time of day; the spec counts time-like texts and rows, and records all texts.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154679');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO lists every recovery point of the database as a separate row with its own timestamp', { tag: '@NJM-154679' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const host = sqlHostFor(source);
  const msdb = new MsdbChain(host, db);
  const chain = new ChainFlows(page, backupFlows);
  const mark = { value: 0 };

  await test.step('1. Precondition: the SQL Server item is in Inventory and the database is in FULL recovery model', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
    const model = await host.recoveryModel(db);
    if (model !== 'FULL') throw new Error(`ABORTED: database ${db} is in ${model || 'an unknown'} recovery model, the case needs FULL`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    mark.value = await msdb.watermark();
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. Run several backups (Full plus incrementals): multiple recovery points exist', async () => {
    expect(await chain.runAndWait()).toBe('successful');
    expect(await chain.runAndWait({ type: 'Differential' })).toBe('successful');
    expect(await chain.runAndWait({ type: 'Log' })).toBe('successful');
    expect((await msdb.since(mark.value)).map((b) => b.type)).toEqual(['D', 'I', 'L']);
  });

  await test.step('4. Open the recovery points of the database: the recovery points table is displayed', async () => {
    const texts = await chain.openRecoveryPicker();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery picker texts: ${texts.slice(0, 100).join(' | ')}` });
    await expect(chain.recovery.pointRows()).not.toHaveCount(0);
  });

  await test.step('5. Review the table: one row and one timestamp for each of the three recovery points', async () => {
    expect(await chain.recovery.pointRows().count()).toBeGreaterThanOrEqual(3);
    const times = (await backupFlows.visibleTexts()).filter((t) => /\d{1,2}:\d{2}/.test(t));
    expect(times.length, 'fewer than 3 time-like texts on the picker').toBeGreaterThanOrEqual(3);
    await chain.closeRecovery();
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Case: Configuration > Repositories > Recovery Points. UI: Recover wizard picker of the job page (UNVERIFIED).' });
  });
});
