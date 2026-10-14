import { test, expect } from '../../../../../fixtures';
import { RUN_OPTIONS } from '../../../../../fixtures/run-options';

// NJM-154541: "[DBM-Inv-UI-Add-Platform-0004] Verify License Tooltip".
// Lab preconditions: signed-in Director on its CURRENT license (it includes Microsoft SQL Server; the lab has no restricted license and the Director's license
//   expires on 2026-10-09 +8 days, after which the state asserted here may change).
// Inventory side effects: none (the wizard is opened and the Application tile is hovered; nothing is added).
// case-vs-ui: the case needs a license WITHOUT the Microsoft SQL Server feature (option greyed out, license tooltip). That state cannot be reproduced; the test asserts what NBR
//   shows now: the Application tile is enabled and hovering it shows NO tooltip (so the exact license text of step 4 is not shown).
// case-vs-ui: Xray "Application/Database" category and "Microsoft SQL Server" option are the single "Application" tile of the Platform step.
// notVerified: the disabled state and the license tooltip text "This functionality is not available in the current license. To enable this functionality, purchase a license or request a trial." (needs a license without the feature).
test.use(RUN_OPTIONS);

test(
  'NAKIVO Add wizard shows the Application platform option enabled and without a license tooltip under the current license',
  { tag: '@NJM-154541' },
  async ({ signedIn: _signedIn, page, inventoryFlows: flows, inventoryPage, addInventoryItemPage, wizardFlows }, testInfo) => {
    const application = addInventoryItemPage.platformRadio('Application');
    let tooltipTexts: string[] = [];

    await test.step('1. Confirm the precondition: Director runs under its current license', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case needs a license WITHOUT Microsoft SQL Server; the lab Director has the current license, which includes it, so the test checks the current license state (the option is enabled instead of greyed out).' });
      await flows.gotoInventory();
      await inventoryPage.openAddWizard();
      await expect(addInventoryItemPage.title).toBeVisible();
      await expect(application).toBeEnabled();
    });

    await test.step('2. Open Settings > Inventory, click Add and go to the Application option; the Application option is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The Platform step has no "Application/Database" category and no separate "Microsoft SQL Server" option; the "Application" tile is the option and it is not disabled.' });
      await expect(page.getByText('Application', { exact: true }).filter({ visible: true })).toBeVisible();
    });

    await test.step('3. Hover the mouse over the Application option; no license tooltip is displayed', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The case expects a license tooltip over the disabled option; the enabled option shows no tooltip.' });
      const tile = page.getByText('Application', { exact: true }).filter({ visible: true });
      tooltipTexts = await wizardFlows.newTextsAfter(() => tile.hover({ timeout: 10_000 }), 3_000);
    });

    await test.step('4. Verify the tooltip text; no license text appears', async () => {
      testInfo.annotations.push({ type: 'case-vs-ui', description: 'The expected license text is not shown in the current UI under the current license; the test asserts that it does not appear.' });
      await testInfo.attach('application-tile-hover-texts', { body: tooltipTexts.join('\n') || '(no new text)', contentType: 'text/plain' });
      expect(tooltipTexts.join(' '), 'a license tooltip appeared on the enabled Application option').not.toMatch(/not available in the current license/i);
      expect(tooltipTexts, 'a tooltip appeared on the enabled Application option').toEqual([]);
    });
  },
);
