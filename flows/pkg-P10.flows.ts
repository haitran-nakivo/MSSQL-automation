import type { InventoryFlows } from './inventory.flows';
import { ITEM_TYPES } from './inventory.flows';
import type { AvailabilityGroupOptions } from '../pages/add-inventory-item.page';

// Helper for the item-details specs (tests/DBs_Services_Apps product/Microsoft SQL Server Database/1. Discovery Scope). It never asserts and never reads .env: the spec passes in what it needs.

// Names of the Inventory items that already exist in the lab (Observed 2026-10-07..10, see the lab environment notes).
// The specs only READ these items; they never change or remove them.
export const LAB_ITEMS = {
  instance: 'WS2022-SQL2025-19.145',
  failoverCluster: 'FCI-33.140',
  alwaysOn: 'AAG-36.6',
  // The Read-Scale AG item is present in some lab states and absent in others; a spec that finds it missing adds it under this name.
  readScale: 'RSAG-33.141',
} as const;

// The Type value of an Always On availability group item (ITEM_TYPES has no entry for it).
export const ALWAYS_ON_TYPE = 'Microsoft SQL Server Always On availability group';

// Opens Inventory and reports whether an item with exactly this name is listed.
export async function listedInInventory(flows: InventoryFlows, name: string): Promise<boolean> {
  await flows.gotoInventory();
  return flows.hasItem(name);
}

// 'added' = the item was added and its discovery completed; the other values are what stopped the add.
export type ReadScaleAddOutcome = 'added' | 'duplicate' | 'failed' | 'timeout';

// Adds a Read-Scale AG item and waits for its discovery.
export async function addReadScaleItem(flows: InventoryFlows, form: AvailabilityGroupOptions): Promise<ReadScaleAddOutcome> {
  await flows.startAdd(ITEM_TYPES.readScale);
  const outcome = await flows.submitAdd(form);
  if (outcome !== 'added') return outcome;
  const discovery = await flows.waitForDiscovery(form.displayName, 600_000);
  return discovery === 'discovered' ? 'added' : discovery;
}
