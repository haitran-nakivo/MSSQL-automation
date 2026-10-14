import { expect } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import { ITEM_TYPES, REMOVE_OPTIONS } from '../flows/inventory.flows';
import type { RemoveHostFlows } from '../flows/remove-host.flows';
import type { MssqlAgTarget, MssqlFciTarget, MssqlInstanceTarget } from './credentials';
import { RemoteHost } from './remote-host';
import type { ServiceState } from './remote-host';

// The assertions the "Remove host" scenarios share (keep transporter / remove transporter / uninstall transporter). They live here,
// not in the flows, because flows never assert. Every scenario creates its own Inventory item for the host (addAndDiscover) and so
// starts from the same state, whatever an earlier scenario did. Observed values (2026-10-07 on 10.10.19.145): the item leaves the list
// within about 1 s; after "keep transporter" the node stays as "Transporter (Installed service)"; the other two options remove the node
// within about 18 s; "uninstall" closes port 9446 at about 4.5 s and removes the service `bhsvc` at about 5 s.
// For an Always On AG the options 2 and 3 remove the nodes of EVERY host of the group (workflows/inventory/remove-mssql-item.md), so a
// scenario checks every member host: see MemberHosts.

export type HostTarget = MssqlInstanceTarget | MssqlAgTarget | MssqlFciTarget;

// The hosts whose nodes and transporters a scenario checks. A standalone instance has one (the host of the item; its node is named after
// the host address, seen on the Nodes page 2026-10-13). A cluster item (FCI, AAG, Read-Scale AG) can bring several: they are learned after
// the first add as the nodes that appeared in Settings > Nodes, so no member host or login has to be configured. The members are assumed to
// accept the OS login of the item (the add itself uses one login for the whole item) for the WinRM service check; this is not verified.
export class MemberHosts {
  private known: string[] | undefined;
  private before = new Set<string>();
  private readonly remotes = new Map<string, RemoteHost>();

  constructor(
    private readonly target: HostTarget,
    private readonly cluster: boolean,
  ) {}

  // Before the add: the nodes that exist now (they are not members of this case).
  async snapshot(flows: RemoveHostFlows): Promise<void> {
    if (this.cluster) this.before = new Set(await flows.nodeNames());
  }

  // After the add and discovery: the nodes that were not there before are the members. Falls back to the item's own host.
  async learn(flows: RemoveHostFlows): Promise<void> {
    if (!this.cluster) {
      this.known = [this.target.host];
      return;
    }
    const added = (await flows.nodeNames()).filter((name) => !this.before.has(name));
    this.known = added.length > 0 ? added : [this.target.host];
  }

  // The hosts to check; before they are learned, the item's own host.
  hosts(): string[] {
    return this.known ?? [this.target.host];
  }

  // Every host that may carry a node or transporter of this case (the item's host and the learned members).
  allHosts(): string[] {
    return [...new Set([this.target.host, ...(this.known ?? [])])];
  }

  remote(host: string): RemoteHost {
    let remote = this.remotes.get(host);
    if (!remote) {
      remote = new RemoteHost(host, this.target.osUsername, this.target.osPassword);
      this.remotes.set(host, remote);
    }
    return remote;
  }
}

// Waits for discovery of an added item. A Failed row is read (Show error) so the report carries the Director's own reason, and it is recorded
// as an "observed-outcome" annotation. A rejected credential pair, or a server the Director cannot reach, is an environment problem and not a product defect, so it ends
// the case ABORTED; any other failure is a FAIL with the Director's text in the message.
export async function expectDiscovered(flows: RemoveHostFlows, testInfo: TestInfo, name: string, timeoutMs: number, what = 'discovery'): Promise<void> {
  const outcome = await flows.waitUntilDiscovered(name, timeoutMs);
  if (outcome === 'failed') {
    const error = (await flows.failedItemError(name)).slice(0, 400);
    testInfo.annotations.push({ type: 'observed-outcome', description: `${what} ended Failed; Show error text: ${error}` });
    if (/credentials are incorrect|insufficient permissions/i.test(error)) {
      throw new Error(`ABORTED: the Director rejected the credentials this case uses for the host (${error}); correct the credentials of its .env group and run again`);
    }
    if (/not reachable|check the connection and server availability/i.test(error)) {
      throw new Error(`ABORTED: the Director cannot reach the server this case adds (${error}); the lab host or its SQL Server is down or not listening, so the case cannot run`);
    }
    expect(outcome, `${what} failed: ${error}`).toBe('discovered');
  }
  expect(outcome, `${what} did not complete`).toBe('discovered');
}

export interface ScenarioOptions {
  /** The wizard type for an add (ITEM_TYPES.*); null keeps the wizard's default type (Always On availability group). Default: the standalone instance. */
  typeName?: string | null;
  members?: MemberHosts;
}

export class RemoveHostScenario {
  // The transporter of the item's own host (a standalone instance has no other).
  readonly remote: RemoteHost;
  readonly members: MemberHosts;
  private readonly typeName: string | null;

  constructor(
    private readonly flows: RemoveHostFlows,
    private readonly target: HostTarget,
    readonly displayName: string,
    private readonly testInfo: TestInfo,
    // Every Inventory name these scenarios use for the host (a crashed run may have left any of them). Only these are ever removed.
    private readonly ownNames: string[] = [displayName],
    options: ScenarioOptions = {},
  ) {
    this.members = options.members ?? new MemberHosts(target, false);
    this.remote = this.members.remote(target.host);
    this.typeName = options.typeName === undefined ? ITEM_TYPES.instance : options.typeName;
  }

  // The state every scenario starts from and ends in: no item of ours in Inventory, no node for the host(s) in Settings > Nodes and no
  // transporter on the host(s) (port 9446 closed, service absent). It copes with whatever an earlier scenario, or a crashed run, left:
  //  - an item of ours still listed: removed with "uninstall transporter";
  //  - a node or a transporter left behind ("remove transporter" leaves the transporter on the host, "keep transporter" leaves both the node
  //    and the transporter): the host is added back under this scenario's name and removed again with "uninstall transporter", which is the
  //    one option that clears both sides; a host that is clean already is left alone.
  // A host listed under a name that is not ours is never touched: ABORTED.
  async ensureCleanState(): Promise<void> {
    for (const name of this.ownNames) {
      if (await this.flows.itemIsListed(name)) {
        await this.remove(REMOVE_OPTIONS.uninstallTransporter, name);
        await this.expectItemGone(name);
      }
    }
    if (!(await this.isClean())) {
      await this.addAndDiscover();
      await this.remove(REMOVE_OPTIONS.uninstallTransporter);
      await this.expectItemGone();
    }
    await this.expectNodeRemoved();
    await this.expectTransporterOnHost(false);
  }

  // Last step of a scenario: the same clean state, so the next scenario starts from it whatever this one did.
  async cleanUp(): Promise<void> {
    await this.ensureCleanState();
  }

  // Clean means: no node for any member host in NBR and nothing listening on the transporter port of any of them.
  private async isClean(): Promise<boolean> {
    for (const host of this.members.allHosts()) {
      if ((await this.flows.nodeRowText(host)) !== undefined) return false;
      if (await this.members.remote(host).transporterPortOpen()) return false;
    }
    return true;
  }

  // Adds the host as the item type of this scenario and waits for discovery. A duplicate (host listed under another name) is ABORTED.
  async addAndDiscover(): Promise<void> {
    await this.members.snapshot(this.flows);
    const outcome = await this.flows.addHost(this.displayName, this.target, this.typeName);
    if (outcome === 'duplicate') throw new Error(`ABORTED: ${this.target.host} is already in Inventory under another name; remove that item and run again`);
    expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
    await expectDiscovered(this.flows, this.testInfo, this.displayName, 600_000);
    await this.members.learn(this.flows);
  }

  // Before the removal: the item is listed, every member host has a node in Settings > Nodes and the transporter runs on it.
  async assertBaseline(): Promise<void> {
    expect(await this.flows.itemIsListed(this.displayName), 'the item is not listed after the add').toBe(true);
    for (const host of this.members.hosts()) {
      await expect.poll(() => this.flows.nodeRowText(host), { timeout: 120_000, message: `no node for ${host} in Settings > Nodes after the add` }).toBeDefined();
      // The add installs the transporter when the host has none (about 40 s observed on a clean host), so the port gets generous time.
      await expect.poll(() => this.members.remote(host).transporterPortOpen(), { timeout: 180_000, message: `the transporter port 9446 is closed on ${host} after the add` }).toBe(true);
      await this.expectService(host, 'Running');
    }
  }

  async remove(option: string, name: string = this.displayName): Promise<void> {
    expect(await this.flows.removeItem(name, option), 'the Remove dialog did not close').toBe(true);
  }

  async expectItemGone(name: string = this.displayName): Promise<void> {
    await expect.poll(() => this.flows.itemIsListed(name), { timeout: 120_000, message: `the removed item "${name}" is still listed in Inventory` }).toBe(false);
  }

  // "Keep transporter": each member's node stays in NBR, now typed "Transporter (Installed service)" like the Onboard transporter
  // (a host added to Inventory is listed as "Physical machine agent"; both seen on the Nodes page 2026-10-13).
  async expectNodeKept(): Promise<void> {
    for (const host of this.members.hosts()) {
      await expect
        .poll(() => this.flows.nodeRowText(host), { timeout: 60_000, message: `the node of ${host} is not in Settings > Nodes as "Transporter (Installed service)"` })
        .toMatch(/Transporter \(Installed service\)/);
    }
  }

  // The other two options: the node of every member host is gone from Settings > Nodes.
  async expectNodeRemoved(): Promise<void> {
    for (const host of this.members.allHosts()) {
      await expect.poll(() => this.flows.nodeRowText(host), { timeout: 120_000, message: `the node of ${host} is still listed in Settings > Nodes` }).toBeUndefined();
    }
  }

  // On the source host(s): the transporter is still there (port open, service running) or it is gone (port closed, service absent).
  async expectTransporterOnHost(present: boolean): Promise<void> {
    for (const host of present ? this.members.hosts() : this.members.allHosts()) {
      await expect.poll(() => this.members.remote(host).transporterPortOpen(), { timeout: 120_000, message: present ? `the transporter port 9446 closed on ${host}` : `the transporter port 9446 is still open on ${host}` }).toBe(present);
      await this.expectService(host, present ? 'Running' : 'Absent');
    }
  }

  // The Windows service check needs WinRM from this PC to the host. When that is not possible the port check above is all there is,
  // and the owner is told in an annotation; it is not a product failure.
  private async expectService(host: string, expected: ServiceState): Promise<void> {
    const remote = this.members.remote(host);
    const probe = await remote.transporterService();
    if (probe.state === 'Unreachable') {
      this.testInfo.annotations.push({ type: 'host-service-check', description: `not done (WinRM from the test PC to ${host} failed: ${probe.detail}); only the port 9446 check was made` });
      return;
    }
    await expect
      .poll(async () => (await remote.transporterService()).state, { timeout: 120_000, message: `the transporter service state on ${host} is not ${expected}` })
      .toBe(expected);
  }
}
