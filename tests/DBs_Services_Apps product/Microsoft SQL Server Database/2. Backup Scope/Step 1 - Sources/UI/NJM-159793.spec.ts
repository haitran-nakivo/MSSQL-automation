import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-159793: "[MSSQL-BK-UI-Souces-0002] Verify Application Type Icons" (same steps as NJM-154775 and its siblings 159793-159796: five cases, one body).
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_FCI_ITEM, NAKIVO_BK_AG_ITEM, NAKIVO_BK_READSCALE_ITEM (one existing Inventory item of each of the four SQL types).
//   A missing value ends the test ABORTED ("Missing in .env").
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: the case names the design assets SQLD001 (standalone + FCI) and SQLD002 (AG + Read-Scale AG); the DOM carries no asset ids, so the icons are compared by their image / class signature:
//   standalone == FCI, AG == Read-Scale AG, and the two groups differ. The signatures are attached as observed-outcome so the owner can match them with SQLD001 / SQLD002.
// UNVERIFIED: the icon element in a tree row (img or class*=icon) was never inspected live.
test.use(RUN_OPTIONS);

test('NAKIVO shows the application type icons of the four SQL item types in the Step 1 source tree', { tag: '@NJM-159793' }, async ({ signedIn: _s, page }, testInfo) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const names = { standalone: readBackupValue('INSTANCE_ITEM'), fci: readBackupValue('FCI_ITEM'), ag: readBackupValue('AG_ITEM'), readScale: readBackupValue('READSCALE_ITEM') };
  let icons: Record<string, string> = {};

  await test.step('1. Precondition and 2. open the wizard on Step 1: all four item types are listed', async () => {
    await flows.openStep1();
    const read = await flows.readTypeIcons(names);
    expect(read.missing, 'items not listed in the source tree').toEqual([]);
    icons = read.icons;
    testInfo.annotations.push({ type: 'observed-outcome', description: `icons: ${JSON.stringify(icons)}` });
  });

  await test.step('3. Standalone instance and Failover Cluster Instance nodes use the same icon (SQLD001)', async () => {
    expect(icons.standalone, 'the standalone instance has no icon').not.toBe('');
    expect(icons.fci).toBe(icons.standalone);
  });

  await test.step('4. Always On Availability Group and Read-Scale AG nodes use the same icon (SQLD002), different from the instance icon', async () => {
    expect(icons.ag, 'the AG has no icon').not.toBe('');
    expect(icons.readScale).toBe(icons.ag);
    expect(icons.ag).not.toBe(icons.standalone);
  });

  await flows.leaveWizard();
});
