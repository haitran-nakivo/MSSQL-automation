import type { TestInfo } from '@playwright/test';
import { test, expect, type InventorySession } from '../../../../fixtures';

// Ordered lifecycle of one Microsoft SQL Server Always On availability group in Inventory, in one browser session:
// 1. Add (happy case, NJM-154527)  2. Add the same group again (negative case #8: duplicate)  3. Edit its Display name.
// The tests depend on each other by design (serial); each one starts from a freshly loaded Inventory list.
// The Add step creates the Inventory item and nothing here removes it (the Remove confirmation is not automated).
// Evidence: workspace/phase4/mssql-ag-lifecycle.md.
test.describe.configure({ mode: 'serial' });

// Adds the availability group from `.env` through the normal wizard and checks that discovery completes.
// Used by the Add test and by the steps that put the item back after a delete case.
async function addAvailabilityGroup(
  { page, inventoryPage, addInventoryItemPage, inventoryItemPage, mssqlAgTarget }: InventorySession,
  testInfo: TestInfo,
): Promise<void> {
  const displayName = `AAG-${mssqlAgTarget.host}`;

  await inventoryPage.goto();
  await inventoryPage.openAddWizard();
  await expect(addInventoryItemPage.title).toBeVisible();
  await addInventoryItemPage.chooseApplication();
  await addInventoryItemPage.next();
  await expect(addInventoryItemPage.typeField).toHaveValue('Microsoft SQL Server Always On availability group');
  await addInventoryItemPage.fillAvailabilityGroup({ displayName, ...mssqlAgTarget });
  await addInventoryItemPage.finish();

  // The wizard closes at once (it stays open when the Director rejects the entry, for example as a duplicate).
  await expect(addInventoryItemPage.title).toBeHidden();
  await expect(inventoryPage.item(displayName)).toBeVisible();

  // Discovery is complete when the row shows "<n> hosts, <n> databases"; it must not end as Failed.
  await expect(inventoryPage.completedDetails(displayName)).toBeVisible({ timeout: 480_000 });
  await expect(inventoryPage.row(displayName).getByText('Failed', { exact: true })).toBeHidden();
  await testInfo.attach('evidence-inventory-list-after-add', { body: await page.screenshot(), contentType: 'image/png' });

  await inventoryPage.openItem(displayName);
  await expect(inventoryItemPage.text(mssqlAgTarget.agName)).toBeVisible();
  await expect(inventoryItemPage.text('Microsoft SQL Server Always On availability group')).toBeVisible();
  await expect(inventoryItemPage.noIssues).toBeVisible();
  await testInfo.attach('evidence-item-page', { body: await page.screenshot(), contentType: 'image/png' });
}

test.describe('Microsoft SQL Server Always On availability group in Inventory: add, duplicate, edit', () => {
  test('1. NAKIVO user can add a Microsoft SQL Server Always On availability group to Inventory', { tag: ['@NJM-154527'] }, async ({ inventorySession }, testInfo) => {
    // Adding runs discovery on the Director; it took 1.5 to 6 minutes when observed.
    test.setTimeout(600_000);
    await addAvailabilityGroup(inventorySession, testInfo);
  });

  test('2. Adding the same availability group again is rejected as a duplicate and creates no second item', async ({
    inventorySession: { page, inventoryPage, addInventoryItemPage, mssqlAgTarget },
  }, testInfo) => {
    const displayName = `AAG-${mssqlAgTarget.host}`;
    await inventoryPage.goto();
    const itemCountBefore = await inventoryPage.itemCount();
    await expect(inventoryPage.item(displayName)).toBeVisible();

    await inventoryPage.openAddWizard();
    await addInventoryItemPage.chooseApplication();
    await addInventoryItemPage.next();
    await addInventoryItemPage.fillAvailabilityGroup({ displayName: `${displayName}-duplicate`, ...mssqlAgTarget });
    await addInventoryItemPage.finish();

    // The wizard stays open and the Director says why. The actual wording is attached to the report.
    const message = addInventoryItemPage.message(/already added to the inventory/);
    await expect(message).toBeVisible({ timeout: 120_000 });
    await testInfo.attach('duplicate-message', { body: (await message.first().innerText()).trim(), contentType: 'text/plain' });
    await expect(message.first()).toContainText('Duplicate entries are not allowed');
    await expect(addInventoryItemPage.title).toBeVisible();
    await testInfo.attach('evidence-duplicate-rejected', { body: await page.screenshot(), contentType: 'image/png' });

    // Back to Inventory: no second item, and the original is still there and still complete.
    await inventoryPage.goto();
    expect(await inventoryPage.itemCount()).toBe(itemCountBefore);
    await expect(inventoryPage.item(displayName)).toBeVisible();
    await expect(inventoryPage.item(`${displayName}-duplicate`)).toHaveCount(0);
    await expect(inventoryPage.completedDetails(displayName)).toBeVisible();
  });

  test('3. NAKIVO user can edit the Display name of the availability group item', async ({
    inventorySession: { page, inventoryPage, inventoryItemPage, editInventoryItemPage, mssqlAgTarget },
  }, testInfo) => {
    test.setTimeout(300_000);
    const original = `AAG-${mssqlAgTarget.host}`;
    const edited = `${original}-edited`;

    async function rename(from: string, to: string): Promise<void> {
      await inventoryPage.goto();
      await inventoryPage.openItem(from);
      await inventoryItemPage.edit();
      await expect(editInventoryItemPage.displayNameField).toHaveValue(from);
      await editInventoryItemPage.setDisplayName(to);
      await editInventoryItemPage.save();
      await expect(editInventoryItemPage.displayNameField).toBeHidden();

      await inventoryPage.goto();
      await expect(inventoryPage.item(to)).toBeVisible();
      await expect(inventoryPage.item(from)).toHaveCount(0);
      await expect(inventoryPage.row(to).getByText('Failed', { exact: true })).toBeHidden();
    }

    await rename(original, edited);
    await testInfo.attach('evidence-edit-list-after-edit', { body: await page.screenshot(), contentType: 'image/png' });
    await inventoryPage.openItem(edited);
    await expect(inventoryItemPage.text(mssqlAgTarget.agName)).toBeVisible();
    await expect(inventoryItemPage.noIssues).toBeVisible();
    await testInfo.attach('evidence-edit-item-page', { body: await page.screenshot(), contentType: 'image/png' });

    // Restore the original name so the item (and a rerun of this suite's lookups) is left as the Add step created it.
    await rename(edited, original);
    await expect(inventoryPage.completedDetails(original)).toBeVisible({ timeout: 240_000 });
  });
});

// Negative cases for editing the existing item (they run after the Edit happy case, in the same session).
// Every case ends without saving a change: either Save is blocked by the form, or the change is cancelled. After each case
// the Edit dialog is opened again to prove the stored values did not change. Evidence: workspace/phase4/mssql-ag-edit-negative-cases.md.
type EditKey = 'host' | 'osUsername' | 'agName' | 'sqlUsername';
const editRequired: { key: EditKey; label: string }[] = [
  { key: 'host', label: 'Hostname or IP' },
  { key: 'osUsername', label: 'OS username' },
  { key: 'agName', label: 'Availability group name' },
  { key: 'sqlUsername', label: 'SQL username' },
];
const allEditFields = ['displayName', 'host', 'osUsername', 'osPassword', 'agName', 'sqlUsername', 'sqlPassword'] as const;

test.describe('Microsoft SQL Server Always On availability group in Inventory: edit negative cases', () => {
  test.beforeEach(async ({ inventorySession: { inventoryPage, inventoryItemPage, editInventoryItemPage, mssqlAgTarget } }) => {
    await openEditDialog(inventoryPage, inventoryItemPage, editInventoryItemPage, `AAG-${mssqlAgTarget.host}`);
    // Clean starting point: nothing in the form is marked invalid before the case changes anything.
    for (const key of allEditFields) {
      await expect(editInventoryItemPage.field(key)).toHaveAttribute('aria-invalid', 'false');
    }
  });

  test.afterEach(async ({ inventorySession: { page, inventoryPage } }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('failure-screenshot', { body: await page.screenshot(), contentType: 'image/png' });
    }
    await inventoryPage.goto(); // back to the Inventory list (closes any open dialog without saving)
  });

  async function openEditDialog(
    inventoryPage: { goto(): Promise<void>; openItem(name: string): Promise<void> },
    inventoryItemPage: { edit(): Promise<void> },
    editPage: { displayNameField: import('@playwright/test').Locator },
    itemName: string,
  ): Promise<void> {
    await inventoryPage.goto();
    await inventoryPage.openItem(itemName);
    await inventoryItemPage.edit();
    await expect(editPage.displayNameField).toHaveValue(itemName);
  }

  for (const { key, label } of editRequired) {
    test(`E. Save without ${label} is blocked and the stored value is unchanged`, async ({
      inventorySession: { page, inventoryPage, inventoryItemPage, editInventoryItemPage, mssqlAgTarget },
    }, testInfo) => {
      const itemName = `AAG-${mssqlAgTarget.host}`;
      const original = await editInventoryItemPage.field(key).inputValue();

      await editInventoryItemPage.clear(key);
      await expect(editInventoryItemPage.field(key)).toHaveAttribute('aria-invalid', 'true');
      await editInventoryItemPage.save();

      await expect(editInventoryItemPage.field(key)).toHaveAttribute('aria-invalid', 'true');
      await expect(editInventoryItemPage.displayNameField).toBeVisible(); // the dialog stays open
      await testInfo.attach('evidence-save-blocked', { body: await page.screenshot(), contentType: 'image/png' });

      await openEditDialog(inventoryPage, inventoryItemPage, editInventoryItemPage, itemName);
      await expect(editInventoryItemPage.field(key)).toHaveValue(original);
    });
  }

  for (const invalidHost of ['bad host name', '!!!']) {
    test(`E. Save with Hostname "${invalidHost}" is blocked and the stored host is unchanged`, async ({
      inventorySession: { page, inventoryPage, inventoryItemPage, editInventoryItemPage, mssqlAgTarget },
    }, testInfo) => {
      const itemName = `AAG-${mssqlAgTarget.host}`;
      const original = await editInventoryItemPage.field('host').inputValue();

      await editInventoryItemPage.replace('host', invalidHost);
      await expect(editInventoryItemPage.field('host')).toHaveAttribute('aria-invalid', 'true');
      await editInventoryItemPage.save();

      await expect(editInventoryItemPage.field('host')).toHaveAttribute('aria-invalid', 'true');
      await expect(editInventoryItemPage.displayNameField).toBeVisible();
      await testInfo.attach('evidence-save-blocked', { body: await page.screenshot(), contentType: 'image/png' });

      await openEditDialog(inventoryPage, inventoryItemPage, editInventoryItemPage, itemName);
      await expect(editInventoryItemPage.field('host')).toHaveValue(original);
    });
  }

  test('E. Cancel after changing the Display name asks for confirmation and discards the change', async ({
    inventorySession: { page, inventoryPage, editInventoryItemPage, mssqlAgTarget },
  }, testInfo) => {
    const itemName = `AAG-${mssqlAgTarget.host}`;
    const discarded = `${itemName}-not-saved`;

    await editInventoryItemPage.setDisplayName(discarded);
    await editInventoryItemPage.cancel();
    await expect(editInventoryItemPage.closePrompt).toBeVisible();
    await expect(editInventoryItemPage.closePromptDetail).toBeVisible();
    await testInfo.attach('evidence-cancel-prompt', { body: await page.screenshot(), contentType: 'image/png' });

    await editInventoryItemPage.confirmClose();
    await expect(editInventoryItemPage.displayNameField).toBeHidden();

    await inventoryPage.goto();
    await expect(inventoryPage.item(itemName)).toBeVisible();
    await expect(inventoryPage.item(discarded)).toHaveCount(0);
  });
});

// Last steps of the lifecycle: delete the item the Add step created, once per Remove choice. They run after every test that needs the item.
// Only the AAG item may disappear: the other Inventory items and nodes must still be listed afterwards.
test.describe('Microsoft SQL Server Always On availability group in Inventory: remove', () => {
  test('Remove dialog offers the three transporter choices and Cancel leaves the item in Inventory', async ({
    inventorySession: { page, inventoryPage, inventoryItemPage, mssqlAgTarget },
  }, testInfo) => {
    const itemName = `AAG-${mssqlAgTarget.host}`;
    await inventoryPage.goto();
    const itemCountBefore = await inventoryPage.itemCount();

    await inventoryPage.openItem(itemName);
    await inventoryItemPage.openRemoveDialog();
    await expect(inventoryItemPage.removeDialog).toBeVisible();
    await expect(inventoryItemPage.removeDialog).toContainText('Remove the host?');
    await expect(inventoryItemPage.removeDialog).toContainText('This host will be removed from the inventory.');
    await expect(inventoryItemPage.removeDialog).toContainText('Do you also want to remove the transporter installed on this host?');
    for (const choice of ['Remove host and keep transporter', 'Remove host and transporter (no uninstall)', 'Remove host and uninstall transporter']) {
      await expect(inventoryItemPage.removeChoice(choice)).toBeVisible();
    }
    await testInfo.attach('evidence-remove-dialog-choices', { body: await page.screenshot(), contentType: 'image/png' });

    await inventoryItemPage.cancelRemove();
    await expect(inventoryItemPage.removeDialog).toBeHidden();
    await inventoryPage.goto();
    await expect(inventoryPage.item(itemName)).toBeVisible();
    expect(await inventoryPage.itemCount()).toBe(itemCountBefore);
  });

  // The three Remove choices. After each delete the item is added again (a test step), because the next case needs it.
  // "keep transporter" must leave the host's node in Settings > Nodes; the other two must remove it. Other nodes and other
  // Inventory items must stay. Nothing on the host's OS can be checked from the UI, so "uninstall" is judged by the Nodes list.
  const removeCases = [
    { choice: 'Remove host and keep transporter', nodeStays: true },
    { choice: 'Remove host and transporter (no uninstall)', nodeStays: false },
    { choice: 'Remove host and uninstall transporter', nodeStays: false },
  ] as const;

  for (const { choice, nodeStays } of removeCases) {
    test(`Delete: "${choice}" removes the item and ${nodeStays ? 'keeps' : 'removes'} the nodes of its hosts`, async ({ inventorySession }, testInfo) => {
      test.setTimeout(1_200_000);
      const { page, inventoryPage, inventoryItemPage, nodesPage, mssqlAgTarget } = inventorySession;
      const itemName = `AAG-${mssqlAgTarget.host}`;

      // Precondition: the item and the host's node exist; the other nodes and items are recorded.
      await nodesPage.goto();
      await expect(nodesPage.node(mssqlAgTarget.host)).toBeVisible();
      const nodesBefore = await nodesPage.nodeNames();
      await inventoryPage.goto();
      const itemCountBefore = await inventoryPage.itemCount();
      // The item's row says how many hosts it has ("2 hosts, 6 databases"); each member host has a node of its own.
      const hostCount = Number(/(\d+) hosts?/.exec(await inventoryPage.completedDetails(itemName).innerText())?.[1]);
      expect(hostCount).toBeGreaterThan(0);
      const otherItems = (await page.locator('.x-grid-row').filter({ visible: true }).allInnerTexts())
        .map((row) => row.split('\n')[0].trim())
        .filter((name) => name !== itemName);
      await expect(inventoryPage.item(itemName)).toBeVisible();

      await test.step(`Delete with "${choice}"`, async () => {
        await inventoryPage.openItem(itemName);
        await inventoryItemPage.openRemoveDialog();
        await expect(inventoryItemPage.removeDialog).toBeVisible();
        await inventoryItemPage.remove(choice);
        await expect(inventoryItemPage.removeDialog).toBeHidden();
      });

      await test.step('The item is gone and nothing else was removed from Inventory', async () => {
        await inventoryPage.goto();
        await expect(inventoryPage.item(itemName)).toHaveCount(0, { timeout: 120_000 });
        expect(await inventoryPage.itemCount()).toBe(itemCountBefore - 1);
        for (const other of otherItems) {
          await expect(inventoryPage.item(other)).toBeVisible();
        }
        await testInfo.attach('evidence-inventory-after-delete', { body: await page.screenshot(), contentType: 'image/png' });
      });

      await test.step(nodeStays ? 'No node is removed in Settings > Nodes' : 'The nodes of the removed hosts are gone from Settings > Nodes; all other nodes stay', async () => {
        if (nodeStays) {
          await nodesPage.goto();
          expect((await nodesPage.nodeNames()).sort()).toEqual([...nodesBefore].sort());
        } else {
          // Observed: removing the transporter removes the node of every host of the availability group (not only the
          // target host's), so the number of removed nodes must equal the item's host count. Removing a node is a Director
          // task, so the list is reloaded until it settles.
          await expect(async () => {
            await nodesPage.goto();
            const after = await nodesPage.nodeNames();
            const removed = nodesBefore.filter((name) => !after.includes(name));
            expect(removed, 'the target host\'s node is removed').toContain(mssqlAgTarget.host);
            expect(removed.length, 'one node removed per host of the item').toBe(hostCount);
            expect(after.length).toBe(nodesBefore.length - hostCount);
          }).toPass({ timeout: 300_000, intervals: [5_000] });
        }
        await testInfo.attach('evidence-nodes-after-delete', { body: await page.screenshot(), contentType: 'image/png' });
      });

      await test.step('Restore: add the availability group to Inventory again', async () => {
        await addAvailabilityGroup(inventorySession, testInfo);
      });
    });
  }
});
