import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../flows/bkA7-tape.flows';
import { backupJobName } from '../../../../../helpers/backup-env';
import { readA7Setup, readTapeDrive } from '../../../../../helpers/bkA7-env';

// NJM-178400: "[MSSQL-BKC-TAPE-02] Verify SQL database backup is copied to a standalone tape drive".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_TAPE_DRIVE (name of a standalone tape drive in Settings > Tape with a loaded tape).
//   Without a standalone drive in the lab the test ends ABORTED.
// Side effects: creates the SQL backup job NJM-178400-src (runs once) and the Backup Copy job NJM-178400 (runs once, writes to the loaded tape); afterEach deletes both jobs (keeping backups). The data on tape stays.
// case-vs-ui: Backup Copy wizard and Tape tab never opened live: locators text based and UNVERIFIED (pages/bkA7-tape.page.ts). "Configuration > Tape" is Settings > Tape. Status IMPLEMENTED_ENV_GATED.
test.use(RUN_OPTIONS);

const KEY = 'NJM-178400';
const created: string[] = [];

test.afterEach(async ({ backupFlows }) => {
  for (const name of [...created].reverse()) {
    try {
      await backupFlows.discardJobIfPresent(name);
    } catch {
      // best effort
    }
  }
  created.length = 0;
});

test(
  'NAKIVO copies a SQL database backup to a standalone tape drive',
  { tag: '@NJM-178400' },
  async ({ signedIn: _s, page, backupFlows }) => {
    test.setTimeout(3_600_000);
    const setup = readA7Setup();
    const drive = readTapeDrive();
    const flows = new BkA7TapeFlows(page, backupFlows);
    const source = backupJobName(KEY, '-src');
    const copy = backupJobName(KEY);

    await test.step('1. Confirm the SQL backup has recovery points in the primary repository and the standalone tape drive with a loaded tape is configured', async () => {
      if (!(await flows.tapeResourceExists(drive))) throw new Error(`ABORTED: tape drive "${drive}" is not listed in Settings > Tape`);
      created.push(source);
      expect(await flows.createAndRunSourceJob(setup, source), 'the source SQL backup did not succeed').toBe('successful');
    });

    await test.step('2. Create a Backup Copy job for the database targeting the standalone tape drive', async () => {
      created.push(copy);
      await flows.createTapeCopyJob({ name: copy, sources: [source], target: drive, finish: 'finish' });
      expect(await backupFlows.jobExists(copy), 'the tape backup copy job was not created').toBe(true);
    });

    await test.step('3. Run the job and open its progress: it starts writing to the standalone drive', async () => {
      await backupFlows.openJob(copy);
      await flows.runOpenCopyJob();
      await expect(backupFlows.jobs.statusLine).toBeVisible({ timeout: 120_000 });
    });

    await test.step('4. Wait for the job to finish: it completes successfully', async () => {
      expect(await backupFlows.waitForResult(3_000_000)).toBe('successful');
    });

    await test.step('5. Open Settings > Tape > the drive and view the loaded tape contents: the recovery point(s) are listed', async () => {
      const rows = await flows.openTapeResource(drive);
      expect(rows.join('\n'), 'the backup is not listed on the tape').toMatch(new RegExp(`${setup.db}|${source}`));
    });
  },
);
