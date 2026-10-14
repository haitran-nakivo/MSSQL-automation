import { test, expect } from '../../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../../fixtures/run-options';
import { readBackupDatabase, readBackupValue } from '../../../../../../helpers/backup-env';
import { BkA3SourcesFlows } from '../../../../../../flows/bkA3-sources.flows';

// NJM-154776: "[MSSQL-BK-UI-Souces-0003] Verify Tree Hierarchy Structure".
// Env (.env, owner-supplied): NAKIVO_BK_INSTANCE_ITEM, NAKIVO_BK_FCI_ITEM, NAKIVO_BK_AG_ITEM, NAKIVO_BK_READSCALE_ITEM (one Inventory item of each SQL type, each with databases),
//   NAKIVO_BK_INSTANCE_DB_SIMPLE (a database of the standalone item). A missing value ends the test ABORTED ("Missing in .env").
// Side effects: none (opens the wizard and cancels it).
// case-vs-ui: Observed: an AG / Read-Scale AG lists only its user databases (no system databases), an instance lists its system databases too, none lists tempdb.
test.use(RUN_OPTIONS);

test('NAKIVO shows each SQL container (instance, FCI, AG, Read-Scale AG) as a parent node with its databases as direct children', { tag: '@NJM-154776' }, async ({ signedIn: _s, page }) => {
  test.setTimeout(300_000);
  const flows = new BkA3SourcesFlows(page);
  const containers = [readBackupValue('INSTANCE_ITEM'), readBackupValue('FCI_ITEM'), readBackupValue('AG_ITEM'), readBackupValue('READSCALE_ITEM')];
  const db = readBackupDatabase('INSTANCE', 'SIMPLE');

  await test.step('1. Precondition and 2. open the wizard on Step 1', async () => {
    await flows.openStep1();
  });

  await test.step('3. Locate the SQL containers in the source tree: each is a top-level parent node', async () => {
    const tree = await flows.readTree();
    for (const name of containers) {
      const node = tree.find((n) => n.name === name);
      expect(node, `"${name}" is not listed`).toBeDefined();
      expect(node?.depth, `"${name}" is not a top-level node`).toBe(0);
    }
  });

  await test.step('4. Expand the containers: individual databases are listed directly as children (one level)', async () => {
    for (const name of containers) {
      const children = await flows.childrenOf(name);
      expect(children.length, `"${name}" shows no child databases`).toBeGreaterThan(0);
    }
    expect(await flows.childrenOf(containers[0])).toContain(db);
    expect((await flows.readTree()).every((n) => n.depth <= 1), 'the tree is deeper than container > database').toBe(true);
  });

  await flows.leaveWizard();
});
