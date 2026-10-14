import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { BkA7TapeFlows } from '../../../../../flows/bkA7-tape.flows';
import { backupJobName } from '../../../../../helpers/backup-env';
import { readA7Setup, readTapeDatabases, readTapeLibrary, readTapeMaxDrives } from '../../../../../helpers/bkA7-env';

// NJM-178403: "Verify database backup objects are queued when they exceed the allocated tape drives".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_REPO_PRIMARY, NAKIVO_BK_TAPE_LIBRARY, NAKIVO_BK_TAPE_MEDIA_POOL, NAKIVO_BK_TAPE_DBS (comma separated databases), NAKIVO_BK_TAPE_MAX_DRIVES
//   (<max-drives>): the number of listed databases must be GREATER than <max-drives>, otherwise the test ends ABORTED ("objects > <max-drives>" is the case's precondition).
// Side effects: creates the SQL backup job NJM-178403-src and the Backup Copy job NJM-178403 (runs once); afterEach deletes both jobs (keeping backups). Tape data stays.
// case-vs-ui: UNVERIFIED (Backup Copy wizard and per-object progress rows never seen live). Queuing is observed by sampling the job page rows once a second (Queued / Waiting rows, active rows); the
//   queued peak is asserted as > 0 only when the samples saw an active row, the active peak is bounded by <max-drives>, and the job must finish successfully. Status PARTIAL.
test.use(RUN_OPTIONS);

const KEY = 'NJM-178403';
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
  'NAKIVO queues database backup objects that exceed the allocated tape drives and finishes them all',
  { tag: '@NJM-178403' },
  async ({ signedIn: _s, page, backupFlows }, testInfo) => {
    test.setTimeout(5_400_000);
    const setup = readA7Setup();
    const tape = readTapeLibrary();
    const dbs = readTapeDatabases();
    const maxDrives = readTapeMaxDrives();
    if (dbs.length <= maxDrives) throw new Error(`ABORTED: NAKIVO_BK_TAPE_DBS lists ${dbs.length} databases, not more than NAKIVO_BK_TAPE_MAX_DRIVES (${maxDrives})`);
    const flows = new BkA7TapeFlows(page, backupFlows);
    const source = backupJobName(KEY, '-src');
    const copy = backupJobName(KEY);

    await test.step('1. Confirm the number of SQL backup objects exceeds the drives allocated to the tape copy job', async () => {
      if (!(await flows.tapeResourceExists(tape.library))) throw new Error(`ABORTED: tape library "${tape.library}" is not listed in Settings > Tape`);
      created.push(source);
      expect(await flows.createAndRunSourceJob(setup, source, dbs), 'the source SQL backup did not succeed').toBe('successful');
      expect(dbs.length).toBeGreaterThan(maxDrives);
    });

    await test.step('2. Create a Backup Copy to Tape job for all the objects with Maximum number of drives = <max-drives>', async () => {
      created.push(copy);
      await flows.createTapeCopyJob({ name: copy, sources: [source], target: tape.library, mediaPool: tape.mediaPool, maxDrives, finish: 'finish' });
      expect(await backupFlows.jobExists(copy)).toBe(true);
    });

    await test.step('3. Run the job and open its progress: the first <max-drives> objects start, the rest are queued', async () => {
      await backupFlows.openJob(copy);
      await flows.runOpenCopyJob();
      await expect(backupFlows.jobs.statusLine).toBeVisible({ timeout: 120_000 });
    });

    await test.step('4. Watch the run as drives free up: queued objects start; never more than <max-drives> at once', async () => {
      const samples = await flows.sampleRun(3_000_000);
      testInfo.annotations.push({ type: 'observed-outcome', description: `Sampled ${samples.samples} times: peak active ${samples.maxActive}, peak queued ${samples.maxQueued}; objects ${dbs.length}, max drives ${maxDrives}` });
      expect(samples.maxActive).toBeLessThanOrEqual(maxDrives);
      if (samples.maxActive > 0) expect(samples.maxQueued, 'no object was seen queued although objects exceed the drives').toBeGreaterThan(0);
    });

    await test.step('5. Wait for the job to finish: all database backup objects complete successfully', async () => {
      expect(await backupFlows.waitForResult(3_000_000)).toBe('successful');
    });
  },
);
