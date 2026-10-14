import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';
import { LAB_ITEMS } from '../../../../../flows/pkg-P09.flows';

// NJM-154657: "[MSSQL-Inv-UI-Details-0012] Verify AG Details Widget (Always On)".
// Lab preconditions: the Always On AG item AAG-36.6 (host 10.10.36.6, single-replica Basic AG) is in Inventory and discovered (shows "N hosts, N databases").
//   The .env AG target (mssqlAgTarget) must point at the AG of this item (10.10.36.6 / AG_TESTDB86; today it still holds the old 10.10.38.76 / AG_TESTDB84).
// Inventory side effects: none (the item is only read).
// case-vs-ui (step 1): the lab AG has one replica (the case asks for two or more); the precondition is the discovered item.
// case-vs-ui (steps 2-3): the Inventory page is Settings > Inventory; the details are an item page.
// case-vs-ui (steps 4-5): NBR 11.2.1 has no "AG Details widget in the summary bar": the AG name, Total databases and SQL version are in the "Instance details"
//   section. Replicas with their roles (primary/secondary) and replica counts per role are not displayed and are not verified. Total databases is compared
//   with the "N databases" of the Inventory row (not with the SQL server).
test.use(RUN_OPTIONS);

const DATABASE_COUNT = /^[1-9]\d*$/;

test(
  'NAKIVO Inventory item page of an Always On availability group shows the AG name, database count and SQL version in Instance details',
  { tag: '@NJM-154657' },
  async ({ signedIn: _signedIn, inventoryFlows: flows, inventoryPage, inventoryItemPage, mssqlAgTarget: target }, testInfo) => {
    test.setTimeout(300_000);
    const name = LAB_ITEMS.alwaysOn;

    await test.step('1. Precondition: the Always On availability group is discovered in Inventory', async () => {
      await flows.gotoInventory();
      if (!(await flows.hasItem(name))) throw new Error(`ABORTED: the Inventory item "${name}" is not in Inventory`);
      await expect(inventoryPage.completedDetails(name)).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154657 step 1: the lab AG has one replica; the case asks for two or more.' });
    });

    await test.step('2. Open the Inventory page: the availability group is listed', async () => {
      await expect(inventoryPage.item(name)).toBeVisible();
    });

    await test.step('3. Open the details of the availability group: its item page is shown', async () => {
      await flows.openItem(name);
      await expect(inventoryItemPage.text('General information')).toBeVisible();
      await expect(inventoryItemPage.noIssues).toBeVisible();
    });

    await test.step('4. The AG details are shown in the Instance details section', async () => {
      await expect(inventoryItemPage.text('Instance details')).toBeVisible();
      await expect(inventoryItemPage.text('AG name:')).toBeVisible();
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154657 step 4: NBR 11.2.1 has no AG Details widget in a summary bar; the AG details are the "Instance details" section.' });
    });

    await test.step('5. The AG name and counts are shown', async () => {
      await expect
        .poll(() => flows.readItemDetails(), { message: 'Instance details does not show the configured availability group' })
        .toMatchObject({ agName: target.agName, totalDatabases: expect.stringMatching(DATABASE_COUNT), noIssues: true });
      const details = await flows.readItemDetails();
      await flows.gotoInventory();
      const row = await flows.readRow(name);
      const match = /(\d+) hosts?, (\d+) databases?/.exec(row.details);
      expect(match, `the Inventory row of ${name} shows no host and database count ("${row.details}")`).not.toBeNull();
      expect(details.totalDatabases).toBe(match?.[2]);
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'NJM-154657 step 5: each replica with its role (primary/secondary) and the replica counts per role are not displayed by NBR 11.2.1 and are not verified; only the AG name, Total databases (equal to the row count), the "N hosts" of the row and No Issues are.' });
    });
  },
);
