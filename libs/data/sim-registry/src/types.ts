import type { SimVersions } from '@vers/db';
import type { Selectable } from 'kysely';

export type SimVersionRow = Selectable<SimVersions>;

export interface UpsertSimVersionInput {
  readonly bunVersion: string;
  readonly engineHash: string;
  readonly imageRef: string;
  readonly maxContentVersion: string;
  readonly providerURL: string;
  readonly retentionDays?: number;
}
