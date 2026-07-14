import type { SimVersionRow } from '@vers/sim-registry';
import { buildProviderAppName } from './build-provider-app-name';

export interface RetentionAction {
  readonly app: string;
  readonly kind: 'destroy-provider-app';
}

/**
 * Turns freshly-tombstoned `sim_versions` rows into the provider-app teardown each one still
 * needs. The row is already `pruned` by the time this plans anything, so a destroy that fails
 * mid-sweep leaves a pruned row with a live app — harmless, dispatch already treats it as expired
 * — rather than an active row with no app to answer it.
 */
export function planRetentionActions(
  tombstoned: ReadonlyArray<SimVersionRow>,
): ReadonlyArray<RetentionAction> {
  return tombstoned.map((row) => ({
    app: buildProviderAppName(row.engineHash),
    kind: 'destroy-provider-app',
  }));
}
