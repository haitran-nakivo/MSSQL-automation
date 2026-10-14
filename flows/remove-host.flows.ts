import type { Page } from '@playwright/test';
import { InventoryFlows, ITEM_TYPES } from './inventory.flows';
import type { AddOutcome, DiscoveryOutcome } from './inventory.flows';
import { NodesPage } from '../pages/nodes.page';
import type { MssqlAgTarget, MssqlFciTarget, MssqlInstanceTarget } from '../helpers/credentials';

// The three "Remove host" scenarios (keep transporter / remove transporter / uninstall transporter) each start from a host that this
// scenario adds to Inventory itself, so no scenario depends on what another left behind. This file holds the shared steps; the specs
// hold the assertions. Same rules as every flows file: no assertions, no .env, no fixed waits.
// The host is added as a standalone SQL Server instance (the add installs the transporter on it). The node of that host is listed in
// Settings > Nodes under the host's address (observed 2026-10-07/08: nodes 10.10.19.145 and 10.10.33.141).

export class RemoveHostFlows {
  private readonly inventory: InventoryFlows;
  private readonly nodes: NodesPage;

  constructor(page: Page) {
    this.inventory = new InventoryFlows(page);
    this.nodes = new NodesPage(page);
  }

  // Adds the host to Inventory under `displayName`, as the given wizard type (null: the wizard's default type, the Always On availability
  // group). 'duplicate' means the host is already listed under another name.
  async addHost(displayName: string, target: MssqlInstanceTarget | MssqlAgTarget | MssqlFciTarget, typeName: string | null = ITEM_TYPES.instance): Promise<AddOutcome> {
    await this.inventory.gotoInventory();
    await this.inventory.startAdd(typeName ?? undefined);
    return this.inventory.submitAdd({ displayName, ...target });
  }

  // The names of all nodes in Settings > Nodes (reloads the Nodes tab).
  async nodeNames(): Promise<string[]> {
    await this.nodes.goto();
    return this.nodes.nodeNames();
  }

  // The added item's row shows its databases (discovery finished) or a Failed badge.
  async waitUntilDiscovered(displayName: string, timeoutMs: number): Promise<DiscoveryOutcome> {
    return this.inventory.waitForDiscovery(displayName, timeoutMs);
  }

  // Opens the item and removes it with one of REMOVE_OPTIONS; true when the Remove dialog closed.
  async removeItem(displayName: string, option: string): Promise<boolean> {
    await this.inventory.gotoInventory();
    await this.inventory.openItem(displayName);
    await this.inventory.openRemoveDialog();
    return this.inventory.confirmRemove(option);
  }

  // The text of the Show error dialog of a Failed row (the Director's own explanation), then closes the dialog.
  async failedItemError(displayName: string): Promise<string> {
    const text = await this.inventory.showFailedItemError(displayName);
    await this.inventory.closeFailedItemError();
    return text;
  }

  async itemIsListed(displayName: string): Promise<boolean> {
    await this.inventory.gotoInventory();
    return this.inventory.isListedWhenLoaded(displayName); // a cleanup decides on "not listed", so wait for the grid to load first
  }

  // The text of the Settings > Nodes row for the host (name, type, ...), or undefined when the host has no node. Reloads the Nodes tab.
  async nodeRowText(host: string): Promise<string | undefined> {
    await this.nodes.goto();
    const row = this.nodes.node(host);
    if ((await row.count()) === 0) return undefined;
    return (await row.first().innerText({ timeout: 10_000 })).replace(/\s+/g, ' ').trim();
  }
}
