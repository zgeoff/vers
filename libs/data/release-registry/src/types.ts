import type { Releases } from '@vers/db';
import type { Selectable } from 'kysely';

/**
 * A persisted `releases` row.
 */
export type ReleaseRow = Selectable<Releases>;

/**
 * `image` must be a deployable registry ref (tag form); `imageDigest` is the digest the fleet
 * resolved it to, null when no single resolved image was readable at record time.
 */
export interface RecordReleaseInput {
  readonly app: string;
  readonly gitSHA: string;
  readonly image: string;
  readonly imageDigest: string | null;
}
