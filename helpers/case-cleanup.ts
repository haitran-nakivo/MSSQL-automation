import type { TestInfo } from '@playwright/test';
import { REMOVE_OPTIONS } from '../flows/inventory.flows';
import type { InventoryFlows } from '../flows/inventory.flows';
import type { RemoveHostFlows } from '../flows/remove-host.flows';
import { RemoveHostScenario } from './remove-host-steps';
import type { HostTarget, ScenarioOptions } from './remove-host-steps';

// Start-clean, final-clean and afterEach cleanup for a case that adds a standalone SQL Server instance (a host that gets a transporter) to
// the Inventory. Shared by helpers/instance-lifecycle.ts and the add-only / edit-only specs. Rules:
//  - Only items whose names this case tracked or listed as its own are ever removed. A host that already has a node in Settings > Nodes or
//    a listener on port 9446 when the case starts is NOT touched: the case ends ABORTED and says what is there.
//  - Removal uses "Remove host and uninstall transporter", the one option that leaves neither a node nor a transporter behind.
//  - What cannot be cleaned is reported (an exception from finish(), an annotation from dispose()), never ignored.
export class CaseCleanup {
  private readonly tracked = new Set<string>();
  private readonly scenario: RemoveHostScenario;
  private finished = false;

  constructor(
    private readonly flows: InventoryFlows,
    private readonly removeHostFlows: RemoveHostFlows,
    private readonly target: HostTarget,
    private readonly testInfo: TestInfo,
    // Every Inventory name this case may leave behind (the first is used for an add-back).
    private readonly ownNames: string[],
    options: ScenarioOptions = {},
  ) {
    this.scenario = new RemoveHostScenario(removeHostFlows, target, ownNames[0], testInfo, ownNames, options);
  }

  // Names created by the case, so that they are removed even when the case stops early.
  track(name: string): void {
    this.tracked.add(name);
  }

  // The case checked for itself that nothing is left, so afterEach has nothing to repeat.
  markFinished(): void {
    this.finished = true;
  }

  get touched(): boolean {
    return this.tracked.size > 0;
  }

  // Start-clean check: the host has no node and no listener on the transporter port that this case did not create.
  async requireNoForeignTransporter(): Promise<void> {
    const node = await this.removeHostFlows.nodeRowText(this.target.host);
    if (node !== undefined) {
      throw new Error(`ABORTED: Settings > Nodes already lists a node for ${this.target.host} ("${node}"): an Inventory item of another name or a leftover of an earlier run. This case never removes it; remove it and run again`);
    }
    if (await this.scenario.members.remote(this.target.host).transporterPortOpen()) {
      throw new Error(`ABORTED: port 9446 is already open on ${this.target.host} (a transporter this case did not install); uninstall it and run again`);
    }
  }

  // What this case left behind: its own Inventory items, a node for the host, a transporter listening on the host. undefined = clean.
  async describeLeftovers(): Promise<string | undefined> {
    const left: string[] = [];
    for (const name of this.ownNames) {
      if (await this.removeHostFlows.itemIsListed(name)) left.push(`Inventory item "${name}"`);
    }
    for (const host of this.scenario.members.allHosts()) {
      const node = await this.removeHostFlows.nodeRowText(host);
      if (node !== undefined) left.push(`node "${node}" in Settings > Nodes`);
      if (await this.scenario.members.remote(host).transporterPortOpen()) left.push(`a transporter listening on port 9446 of ${host}`);
    }
    return left.length > 0 ? left.join('; ') : undefined;
  }

  // Records what NBR and the host look like now (an observation, not an assertion): for cases whose transporter behavior is not verified.
  async recordHostState(label: string): Promise<void> {
    for (const host of this.scenario.members.allHosts()) {
      const node = await this.removeHostFlows.nodeRowText(host);
      const port = await this.scenario.members.remote(host).transporterPortOpen();
      this.testInfo.annotations.push({ type: 'host-state', description: `${label}: Settings > Nodes ${node === undefined ? 'has no node for' : `lists "${node}" for`} ${host}; port 9446 is ${port ? 'open' : 'closed'} on it` });
    }
  }

  // The cleanup step of a case: removes the case's items with "uninstall transporter", then requires a clean host. When a node or
  // transporter is left (a kept transporter, a rejected add that installed one) the host is added back and removed once more; a host
  // that cannot be added (an unsupported OS) cannot be cleaned that way, so what is left is reported as an error.
  async finish(): Promise<void> {
    this.finished = true;
    await this.discard(this.tracked);
    let left = await this.describeLeftovers();
    if (left !== undefined) {
      try {
        await this.scenario.cleanUp();
      } catch {
        // The add-back can fail (unsupported host); what is left is reported below.
      }
      await this.discard(this.ownNames);
      left = await this.describeLeftovers();
    }
    if (left !== undefined) throw new Error(`cleanup incomplete on ${this.target.host}: ${left}`);
  }

  // afterEach: the same cleanup when the case stopped before its own cleanup step. The original failure is what the report shows, so a
  // problem here becomes an annotation. Does nothing when the case never added anything (an ABORTED precondition leaves the host alone).
  async dispose(): Promise<void> {
    if (this.finished || !this.touched) return;
    try {
      await this.finish();
    } catch (error) {
      this.testInfo.annotations.push({ type: 'cleanup-incomplete', description: (error as Error).message.slice(0, 500) });
    }
  }

  private async discard(names: Iterable<string>): Promise<void> {
    for (const name of names) {
      try {
        await this.flows.discardIfPresent(name, REMOVE_OPTIONS.uninstallTransporter);
      } catch {
        // Best effort: describeLeftovers() reports what is still there.
      }
    }
  }
}
