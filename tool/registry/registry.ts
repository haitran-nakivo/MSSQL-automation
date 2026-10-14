import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../config/env.ts';
import { IMPLEMENTATIONS } from './implementations.ts';
import type { Implementation } from './implementations.ts';

// Resolves any Xray test key to what the tool can do with it. The scope data (scope-rev2.json) is the validated revision 2
// of the Discovery Scope assessment: 287 cases, 261 in scope, 26 excluded, each in-scope case in one readiness group.

interface ScopeCase {
  key: string;
  title: string;
  area: string;
  scope: 'in-scope' | 'excluded';
  exclusionReason?: string;
  readiness?: 'ready' | 'investigate-first' | 'waits-for-environment';
  environment?: string;
  priority?: string;
  assertionScope?: 'as-written' | 'follows-current-ui' | 'part-not-verified';
  scopeLine?: string;
  notVerified?: string;
}

interface ScopeFile {
  meta: { revision: number; date: string; total: number; inScope: number; excluded: number };
  cases: ScopeCase[];
}

const scope: ScopeFile = JSON.parse(readFileSync(join(import.meta.dirname, 'scope-rev2.json'), 'utf8'));
const scopeByKey = new Map(scope.cases.map((c) => [c.key, c]));

export type CaseState = 'implemented' | 'planned' | 'investigate-first' | 'waits-for-environment' | 'excluded' | 'unknown';

export interface CaseInfo {
  key: string;
  title: string | null;
  area: string | null;
  state: CaseState;
  // True only for implemented cases: the Execute button is enabled for these and nothing else.
  canExecute: boolean;
  // Why a case cannot run, or a short status for one that can.
  reason: string;
  scopeLine: string | null;
  notVerified: string | null;
  priority: string | null;
  implementation: Implementation | null;
}

export function resolveCase(key: string): CaseInfo {
  const implementation = IMPLEMENTATIONS[key] ?? null;
  const entry = scopeByKey.get(key);
  const base = {
    key,
    title: entry?.title ?? implementation?.title ?? null,
    area: entry?.area ?? null,
    priority: entry?.priority ?? null,
    scopeLine: implementation?.scopeLine ?? entry?.scopeLine ?? null,
    notVerified: implementation?.notVerified ?? entry?.notVerified ?? null,
    implementation,
  };
  if (implementation) return { ...base, state: 'implemented', canExecute: true, reason: 'Automation is implemented.' };
  if (!entry) return { ...base, state: 'unknown', canExecute: false, reason: 'Not in the Discovery Scope assessment and no automation is registered.' };
  if (entry.scope === 'excluded') return { ...base, state: 'excluded', canExecute: false, reason: `Excluded from scope: ${entry.exclusionReason ?? 'owner decision'}` };
  if (entry.readiness === 'waits-for-environment') {
    return { ...base, state: 'waits-for-environment', canExecute: false, reason: `Not implemented yet; it also needs: ${entry.environment ?? 'an environment prerequisite'}.` };
  }
  if (entry.readiness === 'investigate-first') return { ...base, state: 'investigate-first', canExecute: false, reason: 'Not implemented yet; a short UI observation is needed first.' };
  return { ...base, state: 'planned', canExecute: false, reason: 'In scope and ready to implement; not implemented yet.' };
}

// The cases that have automation and can be run.
export function implementedCases(): CaseInfo[] {
  return Object.keys(IMPLEMENTATIONS).map(resolveCase);
}

export function registryStats(): { revision: number; total: number; inScope: number; excluded: number; implemented: number } {
  return { revision: scope.meta.revision, total: scope.meta.total, inScope: scope.meta.inScope, excluded: scope.meta.excluded, implemented: Object.keys(IMPLEMENTATIONS).length };
}

// Drift check, run at startup and shown in the UI: every implementation must point at a spec file that exists and carries
// the case's tag. Returns the problems found (empty = consistent).
export function validateRegistry(): string[] {
  const problems: string[] = [];
  for (const [key, implementation] of Object.entries(IMPLEMENTATIONS)) {
    if (implementation.key !== key) problems.push(`${key}: the entry's key field says ${implementation.key}`);
    const file = join(REPO_ROOT, implementation.spec);
    if (!existsSync(file)) {
      problems.push(`${key}: spec file ${implementation.spec} does not exist`);
      continue;
    }
    if (!new RegExp(`@${key}(?![0-9])`).test(readFileSync(file, 'utf8'))) problems.push(`${key}: spec file ${implementation.spec} has no tag @${key}`);
  }
  const keys = new Set<string>();
  for (const c of scope.cases) {
    if (keys.has(c.key)) problems.push(`${c.key}: appears twice in scope-rev2.json`);
    keys.add(c.key);
  }
  if (scope.cases.length !== scope.meta.total) problems.push(`scope-rev2.json lists ${scope.cases.length} cases but says ${scope.meta.total}`);
  return problems;
}
