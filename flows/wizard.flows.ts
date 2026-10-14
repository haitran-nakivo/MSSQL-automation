import type { Locator, Page } from '@playwright/test';
import { viewingPause } from '../helpers/viewing-pause';
import { AddInventoryItemPage } from '../pages/add-inventory-item.page';
import type { FormInput } from '../pages/add-inventory-item.page';
import { InventoryPage } from '../pages/inventory.page';

// Reads and drives the Options step of the Add Inventory Item wizard, for the cases that check the form itself (fields, required
// marks, limits, tooltips, buttons) rather than adding an item. Same rules as inventory.flows.ts (standards/flows-layer.md): no
// assertions, returns what it saw, waits only on observable state with an explicit timeout.
//
// Facts these helpers rely on (Observed on Director 11.2.1.112232, 2026-10-07; see knowledge note nakivo-mssql-add-inventory-ui):
// - inputs are found by their `name` attribute among the visible inputs; `username` and `password` occur twice (OS first, SQL second);
// - a field the form marks invalid has `aria-invalid="true"` (and a red border); this appears after the field is left (Tab) or
//   after Finish, and validation messages are hover text, not inline text;
// - the info icon next to Hostname and the AG / FCI name field is a `div.qmMain`; its text appears about 0.7 s after a real hover;
// - leaving the wizard by navigating to Settings > Inventory needs no confirmation (the Cancel button asks "Close the wizard?").

export interface FieldState {
  present: boolean;
  value: string;
  readOnly: boolean;
  disabled: boolean;
  invalid: boolean;
}

// Leaf text of everything currently visible. Runs inside the page; it must stay self-contained (no outer variables).
function collectVisibleTexts(): string[] {
  const found = new Set<string>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode() as HTMLElement | null; node; node = walker.nextNode() as HTMLElement | null) {
    if (node.children.length > 0 || node.offsetParent === null) continue;
    const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) found.add(text);
  }
  return [...found];
}

export class WizardFlows {
  // The wizard's buttons and the confirmation Cancel shows. The Cancel button and the "Close the wizard? / All changes will be lost."
  // prompt are the same controls the Edit wizard uses (proven by the Edit specs); on the Add wizard they follow the same pattern.
  readonly finishButton: Locator;
  readonly cancelButton: Locator;
  readonly closePrompt: Locator;
  readonly closeButton: Locator;

  private readonly page: Page;
  private readonly inventory: InventoryPage;
  private readonly add: AddInventoryItemPage;

  constructor(page: Page) {
    this.page = page;
    this.inventory = new InventoryPage(page);
    this.add = new AddInventoryItemPage(page);
    this.finishButton = page.getByRole('button', { name: 'Finish' });
    this.cancelButton = page.getByText('Cancel', { exact: true }).filter({ visible: true });
    this.closePrompt = page.getByText('Close the wizard?').filter({ visible: true });
    this.closeButton = page.getByText('Close', { exact: true }).filter({ visible: true });
  }

  // Clicks Cancel. With changes in the form the wizard asks for confirmation (closePrompt); without changes the wizard may close.
  async cancel(): Promise<void> {
    await this.cancelButton.click({ timeout: 10_000 });
  }

  // Confirms the "Close the wizard?" prompt with Close: the wizard closes and nothing is saved.
  async confirmClose(): Promise<void> {
    await this.closeButton.click({ timeout: 10_000 });
  }

  // Opens Settings > Inventory, the Add wizard and the Options step. Without a type name the default type (Always On) stays.
  async openOptions(typeName?: string): Promise<void> {
    await this.inventory.goto();
    await this.inventory.openAddWizard();
    await this.add.title.waitFor({ timeout: 30_000 });
    await this.add.chooseApplication();
    await this.add.next();
    await viewingPause();
    if (typeName) await this.add.chooseType(typeName);
  }

  // Leaves the wizard by going back to the Inventory list; nothing is saved and nothing is asked.
  async leave(): Promise<void> {
    await this.inventory.goto();
  }

  // ---- fields ----

  async fieldState(name: FormInput, index = 0): Promise<FieldState> {
    const field = this.add.input(name, index);
    if ((await field.count()) === 0) return { present: false, value: '', readOnly: false, disabled: false, invalid: false };
    return field.evaluate((element) => {
      const input = element as HTMLInputElement;
      return { present: true, value: input.value, readOnly: input.readOnly, disabled: input.disabled, invalid: input.getAttribute('aria-invalid') === 'true' };
    });
  }

  // How many inputs with this `name` the form shows (username and password: 2).
  async fieldCount(name: FormInput): Promise<number> {
    return this.page.locator(`input[name="${name}"]:visible`).count();
  }

  async enter(name: FormInput, value: string, index = 0): Promise<void> {
    await this.add.enter(name, value, index);
  }

  // Clicks into a field and leaves it with Tab, without typing: this is what marks an empty required field invalid.
  async touch(name: FormInput, index = 0): Promise<void> {
    const field = this.add.input(name, index);
    await field.click({ timeout: 10_000 });
    await field.press('Tab');
  }

  // Touches every visible input of the form in order (the way a user tabs through an empty form).
  async touchAll(): Promise<void> {
    const inputs = this.page.locator('input:visible');
    const total = await inputs.count();
    for (let i = 0; i < total; i++) {
      const input = inputs.nth(i);
      if (await input.isDisabled()) continue;
      await input.click({ timeout: 10_000 });
      await input.press('Tab');
    }
  }

  // Clicks Finish. With an invalid or empty form the wizard stays open.
  async finish(): Promise<void> {
    await this.add.finish();
  }

  // ---- hover texts (validation messages, tooltips) ----

  // Texts that appear on screen when `action` runs, compared with what was visible before it. Waits for a new text for up to
  // timeoutMs and returns [] when none appears.
  async newTextsAfter(action: () => Promise<void>, timeoutMs = 5_000): Promise<string[]> {
    const before = await this.page.evaluate(collectVisibleTexts);
    await action();
    try {
      // The same leaf-text scan as collectVisibleTexts, written out because a function passed to the page cannot call another
      // one (and building one from a string could be blocked by the page's content security policy).
      await this.page.waitForFunction(
        (known: string[]) => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
          for (let node = walker.nextNode() as HTMLElement | null; node; node = walker.nextNode() as HTMLElement | null) {
            if (node.children.length > 0 || node.offsetParent === null) continue;
            const text = (node.textContent ?? '').replace(/\s+/g, ' ').trim();
            if (text && !known.includes(text)) return true;
          }
          return false;
        },
        before,
        { timeout: timeoutMs },
      );
    } catch (error) {
      if ((error as { name?: string } | null)?.name !== 'TimeoutError') throw error;
      return [];
    }
    const after = await this.page.evaluate(collectVisibleTexts);
    return after.filter((text) => !before.includes(text));
  }

  // The text shown when the mouse rests on a field (for an invalid field: its validation message).
  async hoverText(name: FormInput, index = 0): Promise<string[]> {
    const field = this.add.input(name, index);
    return this.newTextsAfter(() => field.hover({ timeout: 10_000 }));
  }

  // The info icon that follows a field in the document: the first `div.qmMain` after the input. It belongs to the field only for
  // fields that have one (Hostname and the AG / FCI name on the Always On, FCI and Read-Scale forms).
  infoIcon(name: FormInput, index = 0): Locator {
    return this.add.input(name, index).locator('xpath=following::div[contains(@class,"qmMain")][1]');
  }

  // The tooltip text of a field's info icon.
  async tooltip(name: FormInput, index = 0): Promise<string[]> {
    const icon = this.infoIcon(name, index);
    return this.newTextsAfter(() => icon.hover({ timeout: 10_000 }));
  }
}
