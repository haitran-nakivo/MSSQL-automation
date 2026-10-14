import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154682: "[MSSQL-BK-Chain-0009] Verify Selection of Points During Restore" (select a point, Next accepts it).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL (FULL recovery model), NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154682 (deleted in afterEach, backups kept); runs one Full, one Differential and one Log backup. The recovery wizard is opened, one step is taken
//   and it is cancelled; no restore is run.
// case-vs-ui: UNVERIFIED path and rows: Recover (job page) > "Full recovery for individual database" > recovery-point picker (pages/bkA2-recovery.page.ts). "Highlighted as selected" is asserted
//   as an Ext selected-row class (x-grid-item-selected / selected); "the wizard proceeds" as: the visible texts differ after Next.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154682');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO recovery wizard lets the user select one recovery point and proceed with it', { tag: '@NJM-154682' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }) => {
  test.setTimeout(1_200_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const msdb = new MsdbChain(sqlHostFor(source), db);
  const chain = new ChainFlows(page, backupFlows);
  const mark = { value: 0 };
  let before: string[] = [];

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

  await test.step('4. Start the recovery wizard and click a specific recovery point: it is highlighted as selected', async () => {
    await chain.openRecoveryPicker();
    const row = chain.recovery.pointRow('Differential');
    await row.click({ timeout: 10_000 });
    await expect(row).toHaveClass(/selected/);
    before = await backupFlows.visibleTexts();
  });

  await test.step('5. Click Next: the selection is accepted and the wizard proceeds', async () => {
    await chain.acceptRecoveryPoint();
    await expect.poll(async () => JSON.stringify(await backupFlows.visibleTexts()) !== JSON.stringify(before), { timeout: 15_000 }).toBe(true);
    await chain.closeRecovery();
  });
});
