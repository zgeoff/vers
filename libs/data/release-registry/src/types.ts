import type { Releases } from '@vers/db';
import type { Selectable } from 'kysely';

export type ReleaseRow = Selectable<Releases>;

export interface RecordReleaseInput {
  readonly app: string;
  readonly gitSHA: string;
  readonly image: string;
  readonly imageDigest: string | null;
}
