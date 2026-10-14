import type { Page } from '@playwright/test';
import { viewingPause } from '../helpers/viewing-pause';
import { AddInventoryItemPage } from '../pages/add-inventory-item.page';
import type { AvailabilityGroupOptions, FailoverClusterOptions } from '../pages/add-inventory-item.page';
import { EditInventoryItemPage } from '../pages/edit-inventory-item.page';
import type { EditField } from '../pages/edit-inventory-item.page';
import { FailedItemPage } from '../pages/failed-item.page';
import { InventoryItemPage } from '../pages/inventory-item.page';
import { InventoryPage } from '../pages/inventory.page';

// Shared Inventory operations for the Microsoft SQL Server items (see standards/flows-layer.md).
// A flow performs a sequence of page actions and RETURNS WHAT IT SAW. It never asserts: the test decides what is right.
// It waits only for observable UI state (locator.waitFor), never for a fixed time, and it never reads credentials or .env:
// everything it needs is passed in.

// Type names exactly as the wizard's Type field shows them (verified in the existing lifecycle specs).
export const ITEM_TYPES = {
  failoverCluster: 'Microsoft SQL Server failover cluster instance',
  instance: 'Microsoft SQL Server instance',
  readScale: 'Microsoft SQL Server Read-Scale availability group',
} as const;

// The transporter choices of the Remove dialog, by their exact text.
export const REMOVE_OPTIONS = {
  keepTransporter: 'Remove host and keep transporter',
  removeTransporter: 'Remove host and transporter (no uninstall)',
  uninstallTransporter: 'Remove host and uninstall transporter',
} as const;

// What happened to the Add wizard after Finish: it closed (the add started), the Director rejected the entry as a duplicate,
// or neither happened within the time given.
export type AddOutcome = 'added' | 'duplicate' | 'timeout';

// What the Inventory row showed first: its database count (discovery finished), a Failed badge, or neither in time.
export type DiscoveryOutcome = 'discovered' | 'failed' | 'timeout';

export type AddForm = AvailabilityGroupOptions | FailoverClusterOptions;

// The item page's values. agName is set for availability groups, instanceName for instances and failover cluster instances.
export interface ItemDetails {
  type: string;
  os: string;
  agName: string | null;
  instanceName: string | null;
  totalDatabases: string;
  sqlVersion: string;
  noIssues: boolean;
}

// The Edit wizard's text fields (passwords show a mask and are not read).
export interface EditFormValues {
  displayName: string;
  host: string;
  osUsername: string;
  agName: string;
  sqlUsername: string;
}

// Resolves with the first wait that succeeds. 'timeout' is returned only when EVERY wait ended by timing out. Any other error
// (a locator that matches two elements, a closed page) is not an outcome: it is thrown at once, so it can never be misreported as
// a timeout. The waits that lose the race keep running until their own timeout and are ignored (every one has a handler).
function firstOutcome<T extends string>(waits: Promise<T>[]): Promise<T | 'timeout'> {
  return new Promise((resolve, reject) => {
    let timedOut = 0;
    for (const wait of waits) {
      wait.then(resolve, (error: unknown) => {
        if ((error as { name?: string } | null)?.name !== 'TimeoutError') return reject(error);
        if (++timedOut === waits.length) resolve('timeout');
      });
    }
  });
}

export class InventoryFlows {
  private readonly inventory: InventoryPage;
  private readonly add: AddInventoryItemPage;
  private readonly itemPage: InventoryItemPage;
  private readonly edit: EditInventoryItemPage;
  private readonly failed: FailedItemPage;

  constructor(page: Page) {
    this.failed = new FailedItemPage(page);
    this.inventory = new InventoryPage(page);
    this.add = new AddInventoryItemPage(page);
    this.itemPage = new InventoryItemPage(page);
    this.edit = new EditInventoryItemPage(page);
  }

  async gotoInventory(): Promise<void> {
    await this.inventory.goto();
  }

  // Whether an item with this exact name is listed (call after gotoInventory, which waits for the list to load).
  async hasItem(name: string): Promise<boolean> {
    return (await this.inventory.row(name).count()) > 0;
  }

  // Whether the item is listed, decided only after the list has loaded. gotoInventory() already waits for the list, so hasItem() after it
  // is safe too; this also covers a caller that did not just navigate (it waits for a row again). Use it when "not listed" drives a decision.
  async isListedWhenLoaded(name: string): Promise<boolean> {
    await this.inventory.listLoaded();
    return this.hasItem(name);
  }

  // Waits until the item is listed (call after gotoInventory). The list loads after the page does, so hasItem() right after
  // gotoInventory() can see an empty grid; a case that must find the item, or must prove another name is absent, waits here first.
  // Throws a timeout error when the item never shows.
  async waitForItem(name: string, timeoutMs = 30_000): Promise<void> {
    await this.inventory.item(name).waitFor({ state: 'visible', timeout: timeoutMs });
  }

  async openItem(name: string): Promise<void> {
    await this.inventory.openItem(name);
  }

  // ---- add ----

  // Opens the Add wizard on Application > Microsoft SQL Server and picks the type. Stops before any field is filled.
  // Without a type name the wizard's default type is kept (the first in its list, Always On availability group).
  async startAdd(typeName?: string): Promise<void> {
    await this.inventory.openAddWizard();
    // The wizard must be open before anything is clicked in it: without this, a wizard that does not open would leave the next
    // click waiting until the whole test times out (the Playwright config sets no action timeout).
    await this.add.title.waitFor({ timeout: 30_000 });
    await this.add.chooseApplication();
    await this.nextStep();
    if (typeName) await this.add.chooseType(typeName);
  }

  // Next in the Add wizard, then the viewing pause. A flow or spec that moves the Add wizard forward uses this, not the page's next().
  async nextStep(): Promise<void> {
    await this.add.next();
    await viewingPause();
  }

  // Types every field of the form (the Display name first), without clicking Finish.
  async fillAddForm(form: AddForm): Promise<void> {
    if ('agName' in form) await this.add.fillAvailabilityGroup(form);
    else await this.add.fillFailoverCluster(form);
  }

  // Fills the form and finishes it (fillAddForm + finishAdd).
  async submitAdd(form: AddForm, timeoutMs = 60_000): Promise<AddOutcome> {
    await this.fillAddForm(form);
    return this.finishAdd(timeoutMs);
  }

  // Clicks Finish and reports what the wizard did. The wizard closes at once when the add starts and stays open when the
  // Director rejects the entry (a duplicate is the case seen so far).
  async finishAdd(timeoutMs = 60_000): Promise<AddOutcome> {
    await this.add.finish();
    const closed = this.add.title.waitFor({ state: 'hidden', timeout: timeoutMs }).then(() => 'added' as const);
    const duplicate = this.add.message(/Duplicate entries are not allowed/).waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'duplicate' as const);
    return firstOutcome([closed, duplicate]);
  }

  // Waits for the item's row to show a database count ("N databases"), or a Failed badge, whichever comes first.
  async waitForDiscovery(name: string, timeoutMs: number): Promise<DiscoveryOutcome> {
    const discovered = this.inventory.discoveredDetails(name).waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'discovered' as const);
    const failed = this.inventory.row(name).getByText('Failed', { exact: true }).waitFor({ state: 'visible', timeout: timeoutMs }).then(() => 'failed' as const);
    return firstOutcome([discovered, failed]);
  }

  // ---- read ----

  // Reads the open item page once its details have loaded. A test that needs a value to settle polls this.
  async readItemDetails(): Promise<ItemDetails> {
    await this.itemPage.detail('SQL version:').waitFor({ timeout: 30_000 });
    const read = async (label: string): Promise<string> => ((await this.itemPage.detail(label).textContent({ timeout: 10_000 })) ?? '').trim();
    const has = async (label: string): Promise<boolean> => (await this.itemPage.detail(label).count()) > 0;
    return {
      type: await read('Type:'),
      os: await read('Operating system'),
      agName: (await has('AG name:')) ? await read('AG name:') : null,
      instanceName: (await has('Instance name:')) ? await read('Instance name:') : null,
      totalDatabases: await read('Total databases:'),
      sqlVersion: await read('SQL version:'),
      noIssues: await this.itemPage.noIssues.isVisible(),
    };
  }

  // ---- edit ----

  // Opens Edit on the open item page and waits for the form.
  async openEditForm(): Promise<void> {
    await this.itemPage.edit();
    await this.edit.displayNameField.waitFor({ timeout: 30_000 });
  }

  async readEditForm(): Promise<EditFormValues> {
    const value = (key: EditField): Promise<string> => this.edit.field(key).inputValue({ timeout: 10_000 });
    return {
      displayName: await value('displayName'),
      host: await value('host'),
      osUsername: await value('osUsername'),
      agName: await value('agName'),
      sqlUsername: await value('sqlUsername'),
    };
  }

  // Changes the Display name, saves, and reports whether the Edit wizard closed.
  async changeDisplayNameAndSave(newName: string): Promise<boolean> {
    await this.edit.setDisplayName(newName);
    await this.edit.save();
    return this.edit.displayNameField.waitFor({ state: 'hidden', timeout: 30_000 }).then(() => true, () => false);
  }

  // ---- remove ----

  // Opens the Remove dialog on the open item page (it is shown when this returns).
  async openRemoveDialog(): Promise<void> {
    await this.itemPage.openRemoveDialog();
  }

  // Chooses the transporter option, confirms, and reports whether the dialog closed.
  async confirmRemove(option: string): Promise<boolean> {
    await this.itemPage.remove(option);
    return this.itemPage.removeDialog.waitFor({ state: 'hidden', timeout: 30_000 }).then(() => true, () => false);
  }

  // Best-effort removal of an item this test created, for cleanup after a failed run. Returns whether an item was removed.
  async removeIfPresent(name: string, option: string = REMOVE_OPTIONS.keepTransporter): Promise<boolean> {
    await this.inventory.goto();
    if (!(await this.isListedWhenLoaded(name))) return false;
    await this.inventory.openItem(name);
    await this.itemPage.openRemoveDialog();
    await this.itemPage.remove(option);
    return true;
  }

  // ---- failed adds ----

  // Opens the Show error dialog of a Failed row and returns its text. The dialog stays open: close it with closeFailedItemError.
  async showFailedItemError(name: string): Promise<string> {
    await this.failed.showError(name);
    return (await this.failed.errorDialog.innerText({ timeout: 10_000 })).replace(/\s+/g, ' ').trim();
  }

  async closeFailedItemError(): Promise<void> {
    await this.failed.closeError();
  }

  // "Cancel" in the row menu of a Failed item (removes it from Inventory). Returns whether the row left the list.
  async cancelFailedItem(name: string): Promise<boolean> {
    await this.failed.cancelItem(name);
    return this.inventory.row(name).waitFor({ state: 'detached', timeout: 30_000 }).then(() => true, () => false);
  }

  // Cleanup for an item a test created: cancels it when its add Failed, removes it (keep transporter) otherwise.
  // Returns whether an item was removed. Only ever call it with a name the test itself created.
  // `option` is the Remove dialog choice for an item that is not Failed; the default keeps the transporter (and so its node) in NBR.
  async discardIfPresent(name: string, option: string = REMOVE_OPTIONS.keepTransporter): Promise<boolean> {
    await this.inventory.goto();
    if (!(await this.isListedWhenLoaded(name))) return false; // not before the list has loaded, or a listed item is missed and left behind
    await this.waitUntilSettled(name);
    if ((await this.inventory.row(name).getByText('Failed', { exact: true }).count()) > 0) return this.cancelFailedItem(name);
    await this.inventory.openItem(name);
    await this.itemPage.openRemoveDialog();
    await this.itemPage.remove(option);
    return true;
  }

  // An item that is still being added is locked: it can be neither removed nor cancelled (observed: a cleanup that ran right after the add
  // left the item behind, and it later turned Failed). Waits until its row shows how the add ended: a database count, Failed or Inaccessible.
  // Gives up after timeoutMs and lets the caller try anyway.
  async waitUntilSettled(name: string, timeoutMs = 300_000): Promise<void> {
    const row = this.inventory.row(name);
    await row
      .getByText('Failed', { exact: true })
      .or(row.getByText(/d+ databases?/))
      .or(row.getByText('Inaccessible', { exact: true }))
      .first()
      .waitFor({ state: 'visible', timeout: timeoutMs })
      .catch((error: { name?: string }) => {
        if (error?.name !== 'TimeoutError') throw error;
      });
  }

  // ---- read the Inventory list ----

  // The cells of an item's row: name, item type and details (for example "6 databases" or "2 hosts, 6 databases"), and whether
  // the row shows a Failed badge. Call after gotoInventory.
  async readRow(name: string): Promise<{ name: string; type: string; details: string; failed: boolean }> {
    const lines = (await this.inventory.row(name).innerText({ timeout: 10_000 })).split('\n').map((line) => line.trim()).filter(Boolean);
    return { name: lines[0] ?? '', type: lines[1] ?? '', details: lines[2] ?? '', failed: lines.includes('Failed') };
  }
}
