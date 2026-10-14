import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../flows/bkA7-tape.flows';
import { backupJobName } from '../../../../../helpers/backup-env';
import { readA7Setup, readTapeDatabases, readTapeLibrary, readTapeMaxDrives } from '../../../../../helpers/bkA7-env';

// NJM-178402: "Verify multiple database backup objects use parallel tape drives per Maximum number of drives".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_TAPE_LIBRARY (a library with several drives), NAKIVO_BK_TAPE_MEDIA_POOL,
//   NAKIVO_BK_TAPE_DBS (comma separated databases on the instance, at least two: <sql-db-1>, <sql-db-2>, ...), NAKIVO_BK_TAPE_MAX_DRIVES (the <max-drives> value, at least 2). Without them the test ends ABORTED.
// Side effects: creates the SQL backup job NJM-178402-src (all listed databases, runs once) and the Backup Copy job NJM-178402 (runs once); afterEach deletes both jobs (keeping backups). Tape data stays.
// case-vs-ui: UNVERIFIED (Backup Copy wizard, "Maximum number of drives" input and the per-object progress rows were never seen live). The number of drives in use is sampled once a second from the rows of
//   the job page that show an active state (Running / In progress / Writing / Processing); the upper bound (never more than <max-drives> at once) is asserted, the peak is attached as observed-outcome.
//   A sampler can miss a short parallel phase, so "at least two objects in parallel" is asserted only when the samples saw any active row. Status PARTIAL.
test.use(RUN_OPTIONS);

const KEY = 'NJM-178402';
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
  'NAKIVO writes database backup objects to tape in parallel up to the Maximum number of drives',
  { tag: '@NJM-178402' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(5_400_000);
    const setup = readA7Setup();
    const tape = readTapeLibrary();
    const dbs = readTapeDatabases();
    const maxDrives = readTapeMaxDrives();
    if (maxDrives < 2) throw new Error('ABORTED: NAKIVO_BK_TAPE_MAX_DRIVES must be at least 2 to observe parallel drives');
    const flows = new BkA7TapeFlows(page, backupFlows);
    const source = backupJobName(KEY, '-src');
    const copy = backupJobName(KEY);

    await test.step('1. Confirm several SQL backup objects exist in the primary repository and the library has several drives', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      created.push(source);
      expect(await flows.createAndRunSourceJob(setup, source, dbs), 'the source SQL backup did not succeed').toBe('successful');
    });

    await test.step('2. Create a Backup Copy to Tape job with all the backup objects and Maximum number of drives = <max-drives>', async () => {
      created.push(copy);
      await flows.createTapeCopyJob({ name: copy, sources: [source], target: tape.library, mediaPool: tape.mediaPool, maxDrives, finish: 'finish' });
      expect(await backupFlows.jobExists(copy), 'the tape copy job was not created').toBe(true);
    });

    await test.step('3. Run the job and open its progress: up to <max-drives> objects are written at the same time', async () => {
      await backupFlows.openJob(copy);
      await flows.runOpenCopyJob();
      await expect(backupFlows.jobs.statusLine).toBeVisible({ timeout: 120_000 });
    });

    await test.step('4. Verify the number of concurrently active drives during the run: it never exceeds the setting', async () => {
      const samples = await flows.sampleRun(3_000_000);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Sampled ${samples.samples} times: peak active objects ${samples.maxActive}, peak queued ${samples.maxQueued}; max drives ${maxDrives}` });
      expect(samples.maxActive, 'more objects were active than Maximum number of drives').toBeLessThanOrEqual(maxDrives);
      if (samples.maxActive > 0) expect(samples.maxActive, 'objects were processed one at a time although several drives were allowed').toBeGreaterThanOrEqual(2);
      expect(await backupFlows.readOutcome()).toBe('successful');
    });
  },
);
