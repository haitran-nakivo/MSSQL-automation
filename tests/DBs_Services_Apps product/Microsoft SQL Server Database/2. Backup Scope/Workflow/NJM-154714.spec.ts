import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { backupJobName, readBackupDatabase, readBackupRepo, readBackupSource, sqlHostFor } from '../../../../../helpers/backup-env';
import { ChainFlows, MsdbChain } from '../../../../../flows/bkA2-chain.flows';

// NJM-154714: "[MSSQL-BK-WF-0011] Verify Backup Metadata Tracking" (chain id, sequence id, type, timestamp / LSN are kept).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_FULL, NAKIVO_BK_REPO_PRIMARY (+ the NAKIVO_MSSQL_INSTANCE_* login).
// Side effects: creates the on-demand job NJM-154714 (deleted in afterEach, backups kept); runs one Full backup.
// case-vs-ui: PARTIAL. The 11.2.1 UI shows no chain id / LSN of a recovery point (the job page shows the run and, in events, the backup type). The tracked fields are checked where they are visible:
//   in msdb (type, LSNs, timestamp, backup_set_uuid as the unique id) and, as observed-outcome, the backup-type event text on the job page.
test.use(RUN_OPTIONS);

const JOB = backupJobName('NJM-154714');
let jobCreated = false;

test.afterEach(async ({ backupFlows }) => {
  if (!jobCreated) return;
  try { await backupFlows.discardJobIfPresent(JOB); } catch { /* best effort */ }
  jobCreated = false;
});

test('NAKIVO records the type, LSNs, timestamp and unique id of a backup in the backup metadata', { tag: '@NJM-154714' }, async ({ signedIn: _s, page, backupFlows, inventoryFlows }, testInfo) => {
  test.setTimeout(900_000);
  const source = readBackupSource('INSTANCE');
  const db = readBackupDatabase('INSTANCE', 'FULL');
  const repo = readBackupRepo('PRIMARY');
  const msdb = new MsdbChain(sqlHostFor(source), db);
  const chain = new ChainFlows(page, backupFlows);
  let produced: Awaited<ReturnType<ChainFlows['runStep']>>;

  await test.step('1. Precondition: the SQL Server item is in Inventory', async () => {
    await inventoryFlows.gotoInventory();
    if (!(await inventoryFlows.hasItem(source.item))) throw new Error(`ABORTED: the Inventory item "${source.item}" is not listed`);
  });

  await test.step('2. The stream repository is selectable as the destination (the job is created with it)', async () => {
    await chain.createJob({ name: JOB, item: source.item, databases: [db], repo });
    jobCreated = true;
  });

  await test.step('3. Run a SQL backup (Full): a recovery point is created', async () => {
    produced = await chain.runStep(msdb);
    expect(produced.outcome).toBe('successful');
    expect(produced.backups).toHaveLength(1);
  });

  await test.step('4. Inspect the backup properties: type, LSNs, timestamp and unique id are populated and consistent', async () => {
    const b = produced.backups[0];
    expect(b.type).toBe('D');
    expect(b.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(b.firstLsn).toMatch(/^\d+$/);
    expect(b.lastLsn).toMatch(/^\d+$/);
    expect(b.checkpointLsn).toMatch(/^\d+$/);
    expect(BigInt(b.firstLsn) <= BigInt(b.lastLsn)).toBe(true);
    expect(b.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(b.sizeBytes).toBeGreaterThan(0);
    const events = (await backupFlows.visibleTexts()).filter((t) => /Backup type|Run type/i.test(t));
    testInfo.annotations.push({ type: 'observed-outcome', description: `msdb: ${JSON.stringify(b)}; job page type events: ${events.join(' | ') || 'none'}` });
    testInfo.annotations.push({ type: 'case-vs-ui', description: 'Chain id / sequence id are not exposed by the UI; the msdb record is checked.' });
  });
});
