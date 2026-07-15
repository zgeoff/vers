import invariant from 'tiny-invariant';
import { tablesV1 } from './tables/tables-v1';
import type { LootTables } from './types';

const TABLES_BY_VERSION: Readonly<Record<string, LootTables>> = {
  [tablesV1.contentVersion]: tablesV1,
};

/**
 * Callers resolve versions pinned in an activity's `Started` snapshot and every shipped version
 * stays loadable, so an unknown version here is a bug, not input.
 */
export function getTables(contentVersion: string): LootTables {
  const tables = Object.hasOwn(TABLES_BY_VERSION, contentVersion)
    ? TABLES_BY_VERSION[contentVersion]
    : undefined;

  invariant(tables, `unknown content version: ${contentVersion}`);

  return tables;
}
