import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';

/**
 * A single test's isolated database, disposed via `await using`. The service under test and the
 * test body both run through `db`, which is what keeps the code inside the isolation boundary —
 * code that opens its own connection instead bypasses whatever guarantee the strategy provides.
 */
export interface TestDB extends AsyncDisposable {
  readonly db: Kysely<DB>;
}
