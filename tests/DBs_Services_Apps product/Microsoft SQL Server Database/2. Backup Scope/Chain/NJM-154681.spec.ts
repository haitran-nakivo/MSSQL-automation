import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154681: "[MSSQL-BK-Chain-0008] Verify View Points During Restore" (the recovery wizard shows the recovery points).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154681 (deleted in afterEach, backups kept); runs one Full, one Differential and one Log backup. The recovery wizard is opened and closed, no restore is run.
// case-vs-ui: UNVERIFIED path and rows: Recover (job page) > "Full recovery for individual database" > recovery-point picker (pages/bkA2-recovery.page.ts); the picker is assumed to list one grid
//   row per recovery point with its backup type text (Full / Differential / Log).
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154681');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO recovery wizard shows the Full, Differential and Log recovery points of the database', { tag: '@NJM-154681' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const msdb = new MsdbChain(sqlHostFor(source), db);
  const chain = new ChainFlows(page, backupFlows);
  const mark = { value: 0 };

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    mark.value = await msdb.watermark();
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. Ensure multiple recovery points exist: Full, Differential and Log runs succeed', async () => {
    expect(await chain.runAndWait()).toBe('successful');
    expect(await chain.runAndWait({ type: 'Differential' })).toBe('successful');
    expect(await chain.runAndWait({ type: 'Log' })).toBe('successful');
    expect((await msdb.since(mark.value)).map((b) => b.type)).toEqual(['D', 'I', 'L']);
  });

  await test.step('4. Start the recovery wizard and go to the recovery-point selection: the available points are listed', async () => {
    const texts = await chain.openRecoveryPicker();
    testInfo.annotations.push({ type: 'observed-outcome', description: `Recovery picker texts: ${texts.slice(0, 100).join(' | ')}` });
    await expect(chain.recovery.pointRow('Full')).toBeVisible();
    await expect(chain.recovery.pointRow('Differential')).toBeVisible();
    await expect(chain.recovery.pointRow('Log')).toBeVisible();
    await chain.closeRecovery();
  });
});
