import { expect } from '@playwright/test';
import type { TestInfo } from '@playwright/test';
import { ITEM_TYPES, REMOVE_OPTIONS } from '../flows/inventory.flows';
import type { InventoryFlows } from '../flows/inventory.flows';
import type { RemoveHostFlows } from '../flows/remove-host.flows';
import type { WizardFlows } from '../flows/wizard.flows';
import type { AddInventoryItemPage } from '../pages/add-inventory-item.page';
import type { EditInventoryItemPage } from '../pages/edit-inventory-item.page';
import type { InventoryItemPage } from '../pages/inventory-item.page';
import type { InventoryPage } from '../pages/inventory.page';
import type { Page } from '@playwright/test';
import { groupItemName, instanceItemName } from './item-names';
import { CaseCleanup } from './case-cleanup';
import { MemberHosts, RemoveHostScenario, expectDiscovered } from './remove-host-steps';
import type { HostTarget } from './remove-host-steps';

// The shared body of the "Verify adding/ editing/ removing <Windows> hosting <SQL Server>" cases of OS_Platform support/Discovery: a standalone
// SQL Server instance (NJM-154364 is the reference) and the cluster items (failover cluster instance, Always On AG, Read-Scale AG; `kind`). The SPEC keeps the
// test.step list (the Xray steps, their numbers and texts); this class holds what each step does and asserts, so a fix is made once.
// Same rules as helpers/remove-host-steps.ts: assertions live here and in the specs, never in the flows; nothing is read from .env here
// (the spec passes the target); every wait is on an observed UI state.
//
// Host state. The add installs the transporter on the host, and the Remove dialog's three options leave different things behind
// (workflows/inventory/remove-mssql-item.md). So the case:
//   - refuses to start (ABORTED) when the host already has a node in Settings > Nodes or a listener on port 9446: that is a resource this
//     test did not create (a lab item of another name, or a leftover of an earlier run), and it is never removed here;
//   - runs the Remove step once per option (uninstall, remove transporter, keep transporter), each from the clean state and back to it;
//   - ends with no item, no node and no transporter on the host, and repeats that cleanup from afterEach when it stopped early.
// Not verified live for every host: the Windows service `bhsvc` check needs WinRM from the test PC (otherwise only port 9446 is checked, and
// a `host-service-check` annotation says so); the three options were seen on 10.10.16.176 (Windows Server 2022 / SQL Server 2022) only.

export interface InstanceCase {
  /** Xray key, for example 'NJM-154365'. */
  key: string;
  /** The item type; default 'instance'. Cluster items bring several hosts, whose nodes are learned from Settings > Nodes after the add. */
  kind?: ItemKind;
  /** Display-name parts (helpers/item-names.ts): 'WS2022' and 'SQL2019' give WS2022-SQL2019-<octets>. Not used by the cluster kinds (AAG-/RSAG-/FCI-<octets>). */
  osShort?: string;
  sqlShort?: string;
  /** Expected text in the item page's Operating system, for example 'Windows Server 2022'. Omit for a localized host (the text is then only required to be non-empty). */
  osText?: string;
  /** The SQL version's major number: '16' = SQL Server 2022. */
  sqlMajor: string;
  /** Names, for messages only. */
  sqlName: string;
  /** Names of items an older version of a spec created on this host and may have left behind (checked in the precondition, never removed). */
  legacySuffixes?: string[];
}

export type ItemKind = 'instance' | 'fci' | 'ag' | 'readScale';

export interface InstanceDeps {
  /** When given, a screenshot is attached after the key steps (evidence of the actual UI state). */
  page?: Page;
  flows: InventoryFlows;
  inventoryPage: InventoryPage;
  inventoryItemPage: InventoryItemPage;
  editInventoryItemPage: EditInventoryItemPage;
  addInventoryItemPage: AddInventoryItemPage;
  wizardFlows: WizardFlows;
  removeHostFlows: RemoveHostFlows;
}

export interface LifecycleStep {
  title: string;
  run: () => Promise<void>;
}

// Per item kind: the Type field text, the wizard type to pick (the Always On AG is the wizard's default), the item page / Edit form field that
// carries the instance or AG name, and the Display name.
const KINDS = {
  instance: { typeText: ITEM_TYPES.instance, pick: ITEM_TYPES.instance as string | undefined, identity: 'instanceName' as const, formField: 'instanceName' as const },
  fci: { typeText: ITEM_TYPES.failoverCluster, pick: ITEM_TYPES.failoverCluster as string | undefined, identity: 'instanceName' as const, formField: 'instanceName' as const },
  ag: { typeText: 'Microsoft SQL Server Always On availability group', pick: undefined as string | undefined, identity: 'agName' as const, formField: 'availabilityGroupName' as const },
  readScale: { typeText: ITEM_TYPES.readScale, pick: ITEM_TYPES.readScale as string | undefined, identity: 'agName' as const, formField: 'availabilityGroupName' as const },
};

// The Remove options in the order they run, with what NBR 11.2.1 does for each (workflows/inventory/remove-mssql-item.md).
const REMOVAL_OPTIONS = [
  { suffix: 'e', label: 'Remove host and uninstall transporter', option: REMOVE_OPTIONS.uninstallTransporter, nodeStays: false, transporterStays: false },
  { suffix: 'r2', label: 'Remove host and transporter (no uninstall)', option: REMOVE_OPTIONS.removeTransporter, nodeStays: false, transporterStays: true },
  { suffix: 'r3', label: 'Remove host and keep transporter', option: REMOVE_OPTIONS.keepTransporter, nodeStays: true, transporterStays: true },
] as const;

export class InstanceLifecycle {
  readonly displayName: string;
  readonly editedName: string;
  readonly duplicateName: string;
  // Every name this case may leave in Inventory; only these are ever removed.
  readonly ownNames: string[];

  private readonly cleanup: CaseCleanup;
  private readonly members: MemberHosts;
  private readonly k: (typeof KINDS)[ItemKind];
  private readonly typeText: string;
  private active: RemoveHostScenario | undefined;
  private scenarioCleaned = true;
  private itemCountBefore = 0;

  constructor(
    private readonly d: InstanceDeps,
    private readonly target: HostTarget,
    private readonly c: InstanceCase,
    private readonly testInfo: TestInfo,
  ) {
    const kind = c.kind ?? 'instance';
    this.k = KINDS[kind];
    this.typeText = this.k.typeText;
    this.displayName = kind === 'instance' ? instanceItemName(c.osShort ?? '', c.sqlShort ?? '', target.host) : groupItemName(kind === 'fci' ? 'FCI' : kind === 'ag' ? 'AAG' : 'RSAG', target.host);
    this.members = new MemberHosts(target, kind !== 'instance');
    this.editedName = `${this.displayName}-e`;
    this.duplicateName = `${this.displayName}-d`;
    this.ownNames = [this.displayName, this.editedName, this.duplicateName, ...REMOVAL_OPTIONS.slice(1).map((o) => `${this.displayName}-${o.suffix}`)];
    this.cleanup = new CaseCleanup(d.flows, d.removeHostFlows, target, testInfo, this.ownNames, { members: this.members, typeName: this.k.pick ?? null });
  }

  // ---- Xray steps 1 to 6 (add, discovery, edit) ----

  // The host is not in Inventory under a name of this case, and has no node and no transporter that this case did not create.
  async precondition(): Promise<void> {
    const { flows, inventoryPage } = this.d;
    await flows.gotoInventory();
    for (const name of [...this.ownNames, ...(this.c.legacySuffixes ?? []).map((s) => `${this.displayName}-${s}`)]) {
      if (await flows.isListedWhenLoaded(name)) throw new Error(`ABORTED: an Inventory item named "${name}" already exists; remove it and run again`);
    }
    await this.cleanup.requireNoForeignTransporter();
    await this.members.snapshot(this.d.removeHostFlows); // the nodes that exist before this case adds anything
    await flows.gotoInventory();
    this.itemCountBefore = await inventoryPage.itemCount();
  }

  async openAddWizard(): Promise<void> {
    await this.d.flows.startAdd(this.k.pick);
    await expect(this.d.addInventoryItemPage.title).toBeVisible();
    await expect(this.d.addInventoryItemPage.typeField).toHaveValue(this.typeText);
  }

  async addItem(): Promise<void> {
    const outcome = await this.d.flows.submitAdd({ displayName: this.displayName, ...this.target });
    if (outcome === 'duplicate') throw new Error(`ABORTED: ${this.target.host} is already in Inventory under another name; remove that item and run again`);
    this.cleanup.track(this.displayName);
    expect(outcome, 'the Add wizard did not close after Finish').toBe('added');
    await expect(this.d.inventoryPage.item(this.displayName)).toBeVisible();
    await this.shot('evidence-after-add');
  }

  async verifyDiscovery(): Promise<void> {
    const { flows, inventoryPage } = this.d;
    await expectDiscovered(this.d.removeHostFlows, this.testInfo, this.displayName, 600_000);
    await expect(inventoryPage.row(this.displayName).getByText('Failed', { exact: true })).toBeHidden(); // on the Inventory list, where the row is
    await this.members.learn(this.d.removeHostFlows); // opens Settings > Nodes, so it comes before the item page is opened
    await flows.gotoInventory();
    await flows.openItem(this.displayName);
    await this.expectItemPage('the item page does not show the discovered standalone instance');
    const details = await flows.readItemDetails();
    expect(details.sqlVersion.startsWith(`${this.c.sqlMajor}.`), `SQL version "${details.sqlVersion}" is not a ${this.c.sqlName} build`).toBe(true);
    if (this.c.osText) expect(details.os, 'the item page does not show the host operating system').toContain(this.c.osText);
    else expect(details.os, 'the item page shows no operating system').not.toBe('');
    await this.shot('evidence-item-page');
  }

  // Cases that also name the SQL edition: the item page shows the version only, so the edition is not asserted (case-vs-ui).
  async verifyVersionAndEdition(edition: string): Promise<void> {
    this.testInfo.annotations.push({ type: 'case-vs-ui', description: `${this.c.key}: the case expects the ${edition} edition; the item page shows the SQL version only, so only the version (${this.c.sqlName}) is verified.` });
    await this.d.flows.gotoInventory(); // the step does not depend on which page the previous step ended on
    await this.d.flows.openItem(this.displayName);
    await this.expectItemPage('the item page does not show the discovered item');
    const details = await this.d.flows.readItemDetails();
    expect(details.sqlVersion.startsWith(`${this.c.sqlMajor}.`)).toBe(true);
  }

  async rejectDuplicateAdd(): Promise<void> {
    const { flows, inventoryPage, addInventoryItemPage, wizardFlows } = this.d;
    await flows.gotoInventory();
    await flows.startAdd(this.k.pick);
    const again = await flows.submitAdd({ ...this.target, displayName: this.duplicateName });
    this.cleanup.track(this.duplicateName);
    expect(again, 'the Director accepted a second item for the same host').toBe('duplicate');
    await expect(addInventoryItemPage.message(/Duplicate entries are not allowed/)).toBeVisible();
    await wizardFlows.leave();
    await flows.gotoInventory();
    expect(await flows.hasItem(this.duplicateName)).toBe(false);
    expect(await inventoryPage.itemCount()).toBe(this.itemCountBefore + 1);
  }

  async openEditForm(): Promise<void> {
    const { flows, wizardFlows } = this.d;
    await flows.gotoInventory();
    await flows.openItem(this.displayName);
    await flows.openEditForm();
    expect((await wizardFlows.fieldState('name')).value).toBe(this.displayName);
    expect((await wizardFlows.fieldState('host')).value).toBe(this.target.host);
    expect((await wizardFlows.fieldState(this.k.formField)).value).toBe(this.identityValue);
    const typeField = await wizardFlows.fieldState('type');
    expect(typeField.value).toBe(this.typeText);
    expect(typeField.disabled).toBe(true);
  }

  async cancelEdit(): Promise<void> {
    const { flows, wizardFlows, editInventoryItemPage } = this.d;
    await editInventoryItemPage.setDisplayName(this.editedName);
    await wizardFlows.cancel();
    await expect(wizardFlows.closePrompt).toBeVisible();
    await wizardFlows.confirmClose();
    await flows.gotoInventory();
    await flows.waitForItem(this.displayName); // the list has loaded: only now is "the edited name is absent" meaningful
    expect(await flows.hasItem(this.editedName)).toBe(false);
  }

  async saveEdit(): Promise<void> {
    const { flows, inventoryPage } = this.d;
    await flows.gotoInventory();
    await flows.openItem(this.displayName);
    await flows.openEditForm();
    expect(await flows.changeDisplayNameAndSave(this.editedName), 'the Edit wizard did not close after Save').toBe(true);
    this.cleanup.track(this.editedName);
    await flows.gotoInventory();
    await expect(inventoryPage.item(this.editedName)).toBeVisible();
    await expect(inventoryPage.item(this.displayName)).toHaveCount(0);
    await expectDiscovered(this.d.removeHostFlows, this.testInfo, this.editedName, 300_000, 'rediscovery after the edit');
    await expect(inventoryPage.row(this.editedName).getByText('Failed', { exact: true })).toBeHidden();
    await flows.gotoInventory();
    await flows.openItem(this.editedName);
    await this.expectItemPage('the item page does not show the rediscovered item');
  }

  async cancelRemove(): Promise<void> {
    const { flows, inventoryItemPage } = this.d;
    await flows.gotoInventory();
    await flows.openItem(this.editedName);
    await flows.openRemoveDialog();
    await expect(inventoryItemPage.removeDialog).toBeVisible();
    await inventoryItemPage.cancelRemove();
    await expect(inventoryItemPage.removeDialog).toBeHidden();
    await flows.gotoInventory();
    await flows.waitForItem(this.editedName);
    expect(await flows.hasItem(this.editedName)).toBe(true);
  }

  // ---- the Remove step (Xray steps "Remove" and "verify it is gone"), once per option ----

  // The steps for the three options, in order. `firstStep` is the Xray number of the Remove step (7, or 8 when the case has an extra step 5);
  // the verification step gets the next number, only for the first option (the others are repeats of the same two steps).
  removalSteps(firstStep: number): LifecycleStep[] {
    const steps: LifecycleStep[] = [];
    REMOVAL_OPTIONS.forEach((o, i) => {
      const n = i + 1;
      const name = i === 0 ? this.editedName : `${this.displayName}-${o.suffix}`;
      const scenario = new RemoveHostScenario(this.d.removeHostFlows, this.target, name, this.testInfo, this.ownNames, { members: this.members, typeName: this.k.pick ?? null });
      const title = `Removal ${n} (${o.label})`;
      const begin = (): void => {
        this.active = scenario;
        this.scenarioCleaned = false;
      };
      if (n > 1) {
        steps.push({ title: `${title}: precondition: no item, no node and no transporter is left from the previous scenario`, run: async () => { begin(); await scenario.ensureCleanState(); } });
        steps.push({ title: `${title}: add the host to the Inventory again and wait for discovery`, run: async () => { await scenario.addAndDiscover(); this.cleanup.track(name); } });
      }
      steps.push({ title: `${title}: baseline: the item is listed, the host has a node and the transporter runs on the host`, run: async () => { begin(); await scenario.assertBaseline(); } });
      steps.push({ title: `${n === 1 ? `${firstStep}. ` : ''}${title}: select the item, click Remove, choose "${o.label}" and confirm`, run: () => scenario.remove(o.option) });
      steps.push({
        title: `${n === 1 ? `${firstStep + 1}. ` : ''}${title}: NBR: the item is no longer in the Inventory and the node ${o.nodeStays ? 'stays in Settings > Nodes as "Transporter (Installed service)"' : 'is removed from Settings > Nodes'}`,
        run: async () => {
          await scenario.expectItemGone();
          if (o.nodeStays) await scenario.expectNodeKept();
          else await scenario.expectNodeRemoved();
        },
      });
      steps.push({ title: `${title}: source host: the transporter is ${o.transporterStays ? 'still installed and running (port 9446 open, service running)' : 'uninstalled (port 9446 closed, service gone)'}`, run: () => scenario.expectTransporterOnHost(o.transporterStays) });
      steps.push({
        title: `${title}: cleanup: no item, no node and no transporter is left${o.nodeStays || o.transporterStays ? ' (adds the host back and removes it with "uninstall transporter")' : ''}`,
        run: async () => {
          await scenario.cleanUp();
          this.scenarioCleaned = true;
        },
      });
    });
    return steps;
  }

  // Last step: the Inventory is back to its starting item count; no node and no transporter of this case is left.
  async finalCheck(): Promise<void> {
    await this.d.flows.gotoInventory();
    expect(await this.d.inventoryPage.itemCount()).toBe(this.itemCountBefore);
    const left = await this.cleanup.describeLeftovers();
    expect(left, 'something of this case is left in NBR or on the host').toBeUndefined();
    this.cleanup.markFinished();
  }

  // afterEach: returns Inventory, Nodes and the host to the state before the case, whatever step stopped it. Best effort: the original failure
  // is what the report shows. Only names of this case are removed, and the host only when this case's own add put a node or transporter there.
  async dispose(): Promise<void> {
    if (this.active && !this.scenarioCleaned) {
      try {
        await this.active.cleanUp();
      } catch {
        // CaseCleanup below discards what is left and annotates what cannot be cleaned.
      }
    }
    await this.cleanup.dispose();
  }

  private get identityValue(): string {
    return (this.target as unknown as Record<string, string>)[this.k.identity === 'agName' ? 'agName' : 'instanceName'];
  }

  private async shot(name: string): Promise<void> {
    if (!this.d.page) return;
    await this.testInfo.attach(name, { body: await this.d.page.screenshot(), contentType: 'image/png' });
  }

  // The item page of the instance: its type, the instance name, databases found and no issues.
  private async expectItemPage(message: string): Promise<void> {
    await expect
      .poll(() => this.d.flows.readItemDetails(), { message })
      .toMatchObject({ type: this.typeText, [this.k.identity]: this.identityValue, totalDatabases: expect.stringMatching(/^[1-9]\d*$/), noIssues: true });
  }
}
