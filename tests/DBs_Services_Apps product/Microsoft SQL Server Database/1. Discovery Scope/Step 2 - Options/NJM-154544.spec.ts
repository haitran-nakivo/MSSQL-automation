import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154544: "[DBM-Inv-UI-Add-Options-0001] Verify Step 2 UI Layout".
// Lab preconditions: signed-in Director (no SQL target is needed).
// Inventory side effects: none (the wizard is left by returning to the Inventory list).
// case-vs-ui: Xray "Add New" is the "+" button and Xray "Microsoft SQL Server" is the "Application" tile on the Platform step.
// case-vs-ui: the Options page has more fields than the case lists (AG name, SQL username, SQL password, a second Manage credentials link); labels are "Display name", "Hostname or IP", "OS username", "OS password".
// case-vs-ui: "arranged per the specification" (Figma) cannot be checked by code; the spec checks that the fields are present and that no input overlaps another or runs outside the window.
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the Options page with its fields, the Manage credentials link and the Finish and Cancel buttons without overlapping elements',
  { tag: '@NJM-154544' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage }, testInfo) => {
    await test.step('1. Open Settings > Inventory and click Add; the Add Inventory Item wizard opens at the Platform step', async () => {
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(page.getByText('Application', { exact: true })).toBeVisible();
    });

    await test.step('2. Choose Application (Microsoft SQL Server) and click Next; the Options step is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'Xray selects "Microsoft SQL Server" on Step 1; the current UI offers the "Application" tile.' });
      await addInventoryItemPage.chooseApplication();
      await addInventoryItemPage.next();
      await expect(addInventoryItemPage.typeField).toBeVisible();
    });

    await test.step('3. Review the layout; the fields and the Manage credentials link are shown without overlapping or overflowing elements', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects an arrangement "per the specification" (Figma); only the presence of the controls, overlap between inputs and horizontal overflow are checked. The page also holds AG name, SQL username, SQL password and a second Manage credentials link, which the case does not list.' });
      for (const label of [/^Display name:?$/, /^Type:?$/, /^Hostname or IP:?$/, /^OS username:?$/, /^OS password:?$/]) {
        await expect(page.getByText(label).filter({ visible: true }).first(), `label ${String(label)} must be shown`).toBeVisible();
      }
      await expect(addInventoryItemPage.input('name')).toBeVisible();
      await expect(addInventoryItemPage.typeField).toBeVisible();
      await expect(addInventoryItemPage.input('host')).toBeVisible();
      await expect(addInventoryItemPage.input('username', 0)).toBeVisible();
      await expect(addInventoryItemPage.input('password', 0)).toBeVisible();
      await expect(page.getByText('Manage credentials', { exact: true }).filter({ visible: true }).first()).toBeVisible();

      const layout = await page.evaluate(() => {
        const rects = [...document.querySelectorAll('input')]
          .map((element) => ({ name: (element as HTMLInputElement).name, box: element.getBoundingClientRect() }))
          .filter((item) => item.box.width > 0 && item.box.height > 0);
        const overlaps: string[] = [];
        for (let i = 0; i < rects.length; i++) {
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i].box;
            const b = rects[j].box;
            if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push(`${rects[i].name} / ${rects[j].name}`);
          }
        }
        const outside = rects.filter((item) => item.box.left < 0 || item.box.right > window.innerWidth).map((item) => item.name);
        return { overlaps, outside, horizontalScroll: document.documentElement.scrollWidth > window.innerWidth };
      });
      expect(layout.overlaps, 'inputs that overlap each other').toEqual([]);
      expect(layout.outside, 'inputs outside the window width').toEqual([]);
      expect(layout.horizontalScroll, 'the page scrolls horizontally').toBe(false);
    });

    await test.step('4. Inspect the wizard footer; the Finish and Cancel buttons are present', async () => {
      await expect(page.getByRole('button', { name: 'Finish' })).toBeVisible();
      await expect(page.getByText('Cancel', { exact: true }).filter({ visible: true })).toBeVisible();
    });
  },
);
