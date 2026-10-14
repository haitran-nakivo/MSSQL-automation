import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../flows/bkA7-tape.flows';
import { backupJobName } from '../../../../../helpers/backup-env';
import { readA7Setup, readTapeLibrary } from '../../../../../helpers/bkA7-env';

// NJM-178401: "Verify copy-to-tape modes are forever-incremental and incremental with active full".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_MEDIA_POOL. Without a tape library the test ends ABORTED.
// Side effects: creates the SQL backup job NJM-178401-src (runs twice) and the Backup Copy job NJM-178401 (runs three times, writes to tape); afterEach deletes both jobs (keeping backups). Tape data stays.
// case-vs-ui: UNVERIFIED throughout (Backup Copy wizard and Tape tab never opened): the modes are selected by their visible text "Forever-incremental" / "Incremental with active full" wherever a wizard step shows
//   them. "Run the job until an active full is due" cannot be waited for (the interval is days): the job is run once in the active-full mode and the tape contents are attached as observed-outcome; whether a
//   full or an increment was written is asserted only as "the run succeeded and the tape lists the backup". Status PARTIAL.
test.use(RUN_OPTIONS);

const KEY = 'NJM-178401';
const FOREVER = 'Forever-incremental';
const ACTIVE_FULL = 'Incremental with active full';
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
  'NAKIVO offers forever-incremental and incremental-with-active-full modes for copying a SQL backup to tape',
  { tag: '@NJM-178401' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(5_400_000);
    const setup = readA7Setup();
    const tape = readTapeLibrary();
    const flows = new BkA7TapeFlows(page, backupFlows);
    const source = backupJobName(KEY, '-src');
    const copy = backupJobName(KEY);
    let rowsAfterFirst = 0;

    await test.step('Precondition: the SQL backup has a recovery point and the tape library exists', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      created.push(source);
      expect(await flows.createAndRunSourceJob(setup, source)).toBe('successful');
    });

    await test.step('1. Create a Backup Copy to Tape job for the SQL backup targeting the library / media pool', async () => {
      created.push(copy);
      await flows.createTapeCopyJob({ name: copy, sources: [source], target: tape.library, mediaPool: tape.mediaPool, mode: FOREVER, finish: 'finish' });
      expect(await backupFlows.jobExists(copy)).toBe(true);
    });

    await test.step('2. Set the mode to Forever-incremental and run the job: it completes and the backup is on tape', async () => {
      await backupFlows.openJob(copy);
      await flows.runOpenCopyJob();
      expect(await backupFlows.waitForResult(3_000_000)).toBe('successful');
      const rows = await flows.openTapeResource(tape.library);
      rowsAfterFirst = rows.length;
      testInfo.annotations.push({ type: 'observed-outcome', description: `Tape rows after the first forever-incremental run: ${JSON.stringify(rows)}` });
      expect(rows.length).toBeGreaterThan(0);
    });

    await test.step('3. Add a new recovery point on the source and re-run the forever-incremental tape job: it succeeds (only the new point is written)', async () => {
      await backupFlows.openJob(source);
      expect(await flows.rerunSourceJob()).toBe('successful');
      await backupFlows.openJob(copy);
      await flows.runOpenCopyJob();
      expect(await backupFlows.waitForResult(3_000_000)).toBe('successful');
      const rows = await flows.openTapeResource(tape.library);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Tape rows after the second run: ${JSON.stringify(rows)} (before: ${rowsAfterFirst})` });
      expect(rows.length).toBeGreaterThanOrEqual(rowsAfterFirst);
    });

    await test.step('4. Change the mode to Incremental with active full and run the job: it completes', async () => {
      const applied = await flows.changeCopyMode(copy, ACTIVE_FULL);
      expect(applied, `no wizard step of the Backup Copy job shows the mode "${ACTIVE_FULL}"`).toBe(true);
      await backupFlows.openJob(copy);
      await flows.runOpenCopyJob();
      expect(await backupFlows.waitForResult(3_000_000)).toBe('successful');
    });

    await test.step('5. Open Settings > Tape > the library and view the cartridge contents', async () => {
      const rows = await flows.openTapeResource(tape.library);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Final tape rows: ${JSON.stringify(rows)}; an active full due date is not waited for.` });
      expect(rows.length).toBeGreaterThan(0);
    });
  },
);
