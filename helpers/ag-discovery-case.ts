import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { REMOVE_OPTIONS } from '../flows/inventory.flows';
import type { InventoryFlows } from '../flows/inventory.flows';
import type { RemoveHostFlows } from '../flows/remove-host.flows';
import type { InventoryPage } from '../pages/inventory.page';
import { AgTopology } from './ag-topology';
import type { AgTruth } from './ag-topology';
import { expectDiscovered } from './remove-host-steps';

// Shared body of the AG discovery cases that compare NBR with the real availability group: NJM-154501 (AG metadata: listener, replicas,
// roles, databases) and NJM-154503 (a distributed AG is not added as a supported item). The spec keeps the Xray steps; this class does what
// each step does and asserts. Same rules as helpers/instance-lifecycle.ts: assertions here and in specs, never in flows; no .env here.
//
// What the AG item shows in NBR 11.2.1 (item page read on 2026-10-14, AAG-36.6): Display name (the address that was added), Type, Operating
// system, AG name, Total databases, SQL version. The Inventory row shows "N hosts, M databases". It does NOT show the listener name, a list
// of replicas, replica roles or database names. So the case steps that ask for those can only be verified through the counts, and the rest is
// recorded as a `case-vs-ui` annotation, never asserted from invention. The SQL truth (replicas, roles, databases) is read from the SQL Server
// and attached as evidence.
//
// Host state. The lab AG hosts may already carry a NAKIVO transporter (installed by whoever prepared the lab), so this case NEVER uninstalls
// anything: it removes its own item with "Remove host and transporter (no uninstall)", which removes the nodes the add created and leaves the
// software alone. The nodes that exist before the add are recorded and must be the only ones left after the cleanup.
// UNVERIFIED: written before the lab AGs could be used; the first live run decides which locators and counts need a correction.

export interface AgCaseTarget {
  host: string;
  osUsername: string;
  osPassword: string;
  sqlUsername: string;
  sqlPassword: string;
  /** The AG name for the Add wizard; omitted: found from the SQL Server by the listener IP (host). */
  agName?: string;
}

export interface AgCaseDeps {
  page?: Page;
  flows: InventoryFlows;
  inventoryPage: InventoryPage;
  removeHostFlows: RemoveHostFlows;
}

export class AgDiscoveryCase {
  truth: AgTruth | undefined;
  private nodesBefore: string[] = [];
  private itemCountBefore = 0;
  private added = false;
  private cleaned = false;

  constructor(
    private readonly d: AgCaseDeps,
    private readonly target: AgCaseTarget,
    readonly displayName: string,
    private readonly testInfo: TestInfo,
  ) {}

  private get agTruth(): AgTruth {
    if (!this.truth) throw new Error('precondition() has not run');
    return this.truth;
  }

  // ---- precondition ----

  // The AG is reachable and has the shape the case needs; the Inventory has no item of this case; the existing nodes are recorded.
  async precondition(needs: { secondary?: boolean; distributedAg?: boolean }): Promise<void> {
    const truth = await new AgTopology(this.target.host, this.target.sqlUsername, this.target.sqlPassword).gather(this.target.host, this.target.agName);
    this.truth = truth;
    await this.testInfo.attach('sql-ag-truth', { body: JSON.stringify(truth, null, 2), contentType: 'application/json' });
    if (needs.secondary && truth.replicas.length < 2) {
      throw new Error(`ABORTED: the availability group "${truth.agName}" at ${this.target.host} has ${truth.replicas.length} replica(s); the case needs a primary and at least one secondary (the lab is still being prepared)`);
    }
    if (needs.distributedAg && truth.distributedAgs.length === 0) {
      throw new Error(`ABORTED: the SQL Server at ${this.target.host} has no distributed availability group; the case needs one`);
    }
    const { flows, inventoryPage, removeHostFlows } = this.d;
    await flows.gotoInventory();
    if (await flows.isListedWhenLoaded(this.displayName)) throw new Error(`ABORTED: an Inventory item named "${this.displayName}" already exists; remove it and run again`);
    this.nodesBefore = await removeHostFlows.nodeNames();
    await flows.gotoInventory();
    this.itemCountBefore = await inventoryPage.itemCount();
  }

  // ---- add ----

  // Adds the AG through the address of its listener and waits for discovery. A duplicate (the address is already in Inventory) is ABORTED.
  async addAndDiscover(): Promise<void> {
    const { removeHostFlows } = this.d;
    const outcome = await removeHostFlows.addHost(this.displayName, { ...this.target, agName: this.agTruth.agName }, null);
    if (outcome === 'duplicate') throw new Error(`ABORTED: ${this.target.host} is already in Inventory under another name; remove that item and run again`);
    expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
    this.added = true;
    await expectDiscovered(removeHostFlows, this.testInfo, this.displayName, 600_000);
  }

  // Step "enter the address and credentials": the wizard is opened and the entry is accepted (the wizard closes, nothing is rejected).
  async submitEntry(): Promise<void> {
    const { removeHostFlows } = this.d;
    const outcome = await removeHostFlows.addHost(this.displayName, { ...this.target, agName: this.agTruth.agName }, null);
    if (outcome === 'duplicate') throw new Error(`ABORTED: ${this.target.host} is already in Inventory under another name; remove that item and run again`);
    expect(outcome, 'the discovery dialog did not accept the address and credentials').toBe('added');
    this.added = true;
  }

  async waitForDiscovery(): Promise<void> {
    await expectDiscovered(this.d.removeHostFlows, this.testInfo, this.displayName, 600_000);
  }

  // ---- what NBR shows ----

  // The Inventory row's counts: "N hosts, M databases".
  private async rowCounts(): Promise<{ hosts: number | undefined; databases: number | undefined; text: string }> {
    await this.d.flows.gotoInventory();
    const row = await this.d.flows.readRow(this.displayName);
    const hosts = row.details.match(/(\d+) hosts?/);
    const databases = row.details.match(/(\d+) databases?/);
    return { hosts: hosts ? Number(hosts[1]) : undefined, databases: databases ? Number(databases[1]) : undefined, text: row.details };
  }

  // The item is an Always On AG with the AG name of the SQL Server, no issues; the listener name is not shown by the UI (annotation).
  async verifyIdentity(): Promise<void> {
    const { flows, page } = this.d;
    await flows.gotoInventory();
    await flows.openItem(this.displayName);
    await expect
      .poll(() => flows.readItemDetails(), { message: 'the item page does not show the discovered availability group' })
      .toMatchObject({ type: 'Microsoft SQL Server Always On availability group', agName: this.agTruth.agName, noIssues: true });
    const listener = this.agTruth.listenerDns.join(', ') || '(none found on the SQL Server)';
    this.testInfo.annotations.push({
      type: 'case-vs-ui',
      description: `the case expects the listener name on the item; the item page shows the address that was added ("Display name") and the AG name only. SQL Server listener(s): ${listener}.`,
    });
    if (page) await this.testInfo.attach('evidence-ag-item-page', { body: await page.screenshot(), contentType: 'image/png' });
  }

  // Replicas: NBR shows only how many hosts the AG has, so the count is compared with the replicas of the SQL Server, and the nodes that
  // appeared in Settings > Nodes are recorded. The replica names and the roles are not shown (annotation).
  async verifyReplicas(): Promise<void> {
    const counts = await this.rowCounts();
    expect(counts.hosts, `the Inventory row "${counts.text}" does not show a host count`).toBeDefined();
    expect(counts.hosts, `hosts shown by NBR (${counts.text}) vs replicas on the SQL Server (${this.agTruth.replicas.map((r) => r.server).join(', ')})`).toBe(this.agTruth.replicas.length);
    const nodes = (await this.d.removeHostFlows.nodeNames()).filter((n) => !this.nodesBefore.includes(n));
    this.testInfo.annotations.push({ type: 'observed-outcome', description: `nodes added to Settings > Nodes by this add: ${nodes.join(', ') || '(none)'}; replicas on the SQL Server: ${this.agTruth.replicas.map((r) => r.server).join(', ')}` });
    this.testInfo.annotations.push({ type: 'case-vs-ui', description: 'the case expects the replicas listed under the AG object; NBR 11.2.1 shows only the number of hosts, so the count is compared and the names are recorded.' });
  }

  // Roles: NBR shows no replica role. If a role word is on the item page or the row it must match the SQL Server; otherwise the step only records that.
  async verifyRoles(): Promise<void> {
    const { flows, page } = this.d;
    await flows.gotoInventory();
    const row = await flows.readRow(this.displayName);
    await flows.openItem(this.displayName);
    await expect.poll(() => flows.readItemDetails(), { message: 'the item page did not load' }).toMatchObject({ agName: this.agTruth.agName });
    const shown = ((page && (await page.locator('body').innerText())) || row.details).toUpperCase();
    const roleWords = ['PRIMARY', 'SECONDARY'].filter((w) => shown.includes(w));
    const sqlRoles = this.agTruth.replicas.map((r) => `${r.server}=${r.role}`).join(', ');
    if (roleWords.length > 0) {
      expect(roleWords, `roles shown by NBR vs SQL Server (${sqlRoles})`).toEqual(expect.arrayContaining(['PRIMARY']));
    }
    this.testInfo.annotations.push({ type: 'case-vs-ui', description: `replica roles: ${roleWords.length > 0 ? `the page mentions ${roleWords.join('/')}` : 'NBR 11.2.1 shows no replica role'}; SQL Server reports ${sqlRoles}. Only what is shown could be compared.` });
  }

  // Databases: the count NBR shows (row and item page) equals the availability databases of the SQL Server; the names are recorded.
  async verifyDatabases(): Promise<void> {
    const truth = this.agTruth;
    const counts = await this.rowCounts();
    expect(counts.databases, `databases shown by the row "${counts.text}" vs availability databases (${truth.databases.join(', ')})`).toBe(truth.databases.length);
    await this.d.flows.openItem(this.displayName);
    await expect
      .poll(async () => (await this.d.flows.readItemDetails()).totalDatabases, { message: 'Total databases on the item page' })
      .toBe(String(truth.databases.length));
    this.testInfo.annotations.push({ type: 'case-vs-ui', description: `the case expects the database names under the AG object; NBR 11.2.1 shows the count only. Availability databases on the SQL Server: ${truth.databases.join(', ')}.` });
  }

  // NJM-154503: discovery added the AG that the address belongs to, and nothing for the distributed AG: one new item, of the AG type, named
  // for the underlying AG, and no item with the name of a distributed AG.
  async verifyDagNotAdded(): Promise<void> {
    const { flows, inventoryPage } = this.d;
    const truth = this.agTruth;
    await flows.gotoInventory();
    expect(await inventoryPage.itemCount(), 'exactly one item (the AG) must have been added').toBe(this.itemCountBefore + 1);
    for (const dag of truth.distributedAgs) {
      expect(await flows.hasItem(dag), `an Inventory item named like the distributed AG "${dag}" exists`).toBe(false);
    }
    await expect(inventoryPage.row(this.displayName).getByText('Failed', { exact: true })).toBeHidden();
    await flows.openItem(this.displayName);
    await expect
      .poll(() => flows.readItemDetails(), { message: 'the item page does not show the underlying availability group' })
      .toMatchObject({ type: 'Microsoft SQL Server Always On availability group', agName: truth.agName });
    expect(truth.distributedAgs, 'the AG name shown must not be a distributed AG name').not.toContain(truth.agName);
    this.testInfo.annotations.push({
      type: 'case-vs-ui',
      description: `step 3 of the case says both "does not add the DAG as a supported item" and "Discovery added AG successfully". Both hold when the underlying AG "${truth.agName}" is added and the distributed AG (${truth.distributedAgs.join(', ')}) is not; that is what is asserted.`,
    });
  }

  // ---- cleanup ----

  // Not part of the case: removes the item with "remove transporter (no uninstall)" and requires the Inventory and the nodes to be as before.
  async cleanUp(): Promise<void> {
    const { flows, inventoryPage, removeHostFlows } = this.d;
    if (await removeHostFlows.itemIsListed(this.displayName)) {
      expect(await removeHostFlows.removeItem(this.displayName, REMOVE_OPTIONS.removeTransporter), 'the Remove dialog did not close').toBe(true);
      await expect.poll(() => removeHostFlows.itemIsListed(this.displayName), { timeout: 120_000, message: `the removed item "${this.displayName}" is still listed` }).toBe(false);
    }
    await flows.gotoInventory();
    expect(await inventoryPage.itemCount(), 'the Inventory is not back to its starting item count').toBe(this.itemCountBefore);
    await expect
      .poll(async () => (await removeHostFlows.nodeNames()).filter((n) => !this.nodesBefore.includes(n)), { timeout: 120_000, message: 'nodes created by this case are still in Settings > Nodes' })
      .toEqual([]);
    this.cleaned = true;
  }

  // afterEach: the same cleanup if the case stopped early (best effort; a problem becomes an annotation).
  async dispose(): Promise<void> {
    if (this.cleaned || !this.added) return;
    try {
      await this.cleanUp();
    } catch (error) {
      this.testInfo.annotations.push({ type: 'cleanup-incomplete', description: (error as Error).message.slice(0, 500) });
    }
  }
}
