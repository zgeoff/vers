import type { SimVersions } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * A persisted `sim_versions` row.
 */
export type SimVersionRow = Selectable<SimVersions>;

/**
 * Input for `upsertSimVersion`. `retentionDays` defaults to `DEFAULT_RETENTION_DAYS` when omitted.
 */
export interface UpsertSimVersionInput {
  readonly bunVersion: string;
  readonly engineHash: string;
  readonly imageRef: string;
  readonly providerURL: string;
  readonly retentionDays?: number;
}
