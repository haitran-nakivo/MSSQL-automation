import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../flows/bkA7-tape.flows';
import { backupJobName } from '../../../../../helpers/backup-env';
import { readA7Setup, readTapeLibrary } from '../../../../../helpers/bkA7-env';

// NJM-178399: "[MSSQL-BKC-TAPE-01] Verify SQL database backup is copied to a tape library successfully".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_TAPE_LIBRARY (name of a tape library in Settings > Tape with available tapes),
//   NAKIVO_BK_TAPE_MEDIA_POOL (its media pool). Without a tape library in the lab the test ends ABORTED.
// Side effects: creates the SQL backup job NJM-178399-src (runs once) and the Backup Copy job NJM-178399 (runs once, writes to tape); afterEach deletes both jobs (keeping backups). The data written
//   to tape stays on the cartridge.
// case-vs-ui: the Backup Copy wizard and the Tape tab were never opened live: every locator is text based and UNVERIFIED (pages/bkA7-tape.page.ts). "Configuration > Tape" is Settings > Tape in the UI
//   (route /c/configuration). Status IMPLEMENTED_ENV_GATED.
test.use(RUN_OPTIONS);

const KEY = 'NJM-178399';
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
  'NAKIVO copies a SQL database backup to a tape library',
  { tag: '@NJM-178399' },
  async ({ signedIn: _s, page, backupFlows }) => {
    test.setTimeout(3_600_000);
    const setup = readA7Setup();
    const tape = readTapeLibrary();
    const flows = new BkA7TapeFlows(page, backupFlows);
    const source = backupJobName(KEY, '-src');
    const copy = backupJobName(KEY);

    await test.step('1. Confirm the SQL backup has recovery points in the primary repository and the tape library with its media pool is configured', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      created.push(source);
      expect(await flows.createAndRunSourceJob(setup, source), 'the source SQL backup did not succeed').toBe('successful');
    });

    await test.step('2. Create a Backup Copy job for the database targeting the tape library (Data Protection > + > Backup Copy Job)', async () => {
      created.push(copy);
      await flows.createTapeCopyJob({ name: copy, sources: [source], target: tape.library, mediaPool: tape.mediaPool, finish: 'finish' });
      expect(await backupFlows.jobExists(copy), 'the tape backup copy job was not created').toBe(true);
    });

    await test.step('3. Run the job and open its progress: it starts writing to tape', async () => {
      await backupFlows.openJob(copy);
      await flows.runOpenCopyJob();
      await expect(backupFlows.jobs.statusLine).toBeVisible({ timeout: 120_000 });
    });

    await test.step('4. Wait for the job to finish: it completes successfully', async () => {
      expect(await backupFlows.waitForResult(3_000_000)).toBe('successful');
    });

    await test.step('5. Open Settings > Tape > the library and view the cartridge contents: the recovery point(s) are listed', async () => {
      const rows = await flows.openTapeResource(tape.library);
      expect(rows.join('\n'), 'the backup is not listed on the cartridge').toMatch(new RegExp(`${setup.db}|${source}`));
    });
  },
);
