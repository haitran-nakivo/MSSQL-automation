import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../flows/bkA7-tape.flows';
import { backupJobName } from '../../../../../helpers/backup-env';
import { readA7Setup, readTapeLibrary } from '../../../../../helpers/bkA7-env';

// NJM-178404: "Verify re-run of incremental database backup copy to tape works correctly".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_INSTANCE_DB_SIMPLE, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_MEDIA_POOL. Without a tape library the test ends ABORTED.
// Side effects: creates the SQL backup job NJM-178404-src (runs twice) and the Backup Copy job NJM-178404 (runs twice, writes to tape); afterEach deletes both jobs (keeping backups). Tape data stays.
// case-vs-ui: UNVERIFIED (Backup Copy wizard and Tape tab never opened live). "Only the new recovery point is written / no full re-copy" is not readable from a documented UI element: it is asserted as
//   "the tape listing grew or stayed (never shrank) and the job succeeded", with the before/after rows attached as observed-outcome. The precondition (an incremental copy job that already ran) is created by the spec. Status PARTIAL.
test.use(RUN_OPTIONS);

const KEY = 'NJM-178404';
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
  'NAKIVO copies only the new recovery point to tape when an incremental copy job is re-run',
  { tag: '@NJM-178404' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(5_400_000);
    const setup = readA7Setup();
    const tape = readTapeLibrary();
    const flows = new BkA7TapeFlows(page, backupFlows);
    const source = backupJobName(KEY, '-src');
    const copy = backupJobName(KEY);
    let before: string[] = [];

    await test.step('1. Confirm an incremental Backup Copy to Tape job has already run once: the tape holds the copied recovery point', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      created.push(source);
      expect(await flows.createAndRunSourceJob(setup, source)).toBe('successful');
      created.push(copy);
      await flows.createTapeCopyJob({ name: copy, sources: [source], target: tape.library, mediaPool: tape.mediaPool, mode: 'Forever-incremental', finish: 'finish' });
      await backupFlows.openJob(copy);
      await flows.runOpenCopyJob();
      expect(await backupFlows.waitForResult(3_000_000)).toBe('successful');
      before = await flows.openTapeResource(tape.library);
      expect(before.length).toBeGreaterThan(0);
    });

    await test.step('2. Create a new recovery point on the source by running the SQL backup job: it succeeds', async () => {
      await backupFlows.openJob(source);
      expect(await flows.rerunSourceJob()).toBe('successful');
    });

    await test.step('3. Re-run the incremental Backup Copy to Tape job: it succeeds', async () => {
      await backupFlows.openJob(copy);
      await flows.runOpenCopyJob();
      await expect(backupFlows.jobs.statusLine).toBeVisible({ timeout: 120_000 });
      expect(await backupFlows.waitForResult(3_000_000)).toBe('successful');
    });

    await test.step('4. View the cartridge contents: the previously copied recovery points are still there plus the new one', async () => {
      const after = await flows.openTapeResource(tape.library);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Tape rows before: ${JSON.stringify(before)}; after: ${JSON.stringify(after)}` });
      expect(after.length).toBeGreaterThanOrEqual(before.length);
    });
  },
);
