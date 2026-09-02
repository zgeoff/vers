import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

export interface TestDBHandle extends AsyncDisposable {
  readonly db: Kysely<DB>;
}
