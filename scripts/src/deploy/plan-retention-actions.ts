import type { SimVersionRow } from '@vers/sim-registry';
import { buildProviderAppName } from './build-provider-app-name';

export interface RetentionAction {
  readonly app: string;
  readonly kind: 'destroy-provider-app';
}

export function planRetentionActions(
  tombstoned: ReadonlyArray<SimVersionRow>,
): ReadonlyArray<RetentionAction> {
  return tombstoned.map((row) => ({
    app: buildProviderAppName(row.engineHash),
    kind: 'destroy-provider-app',
  }));
}
