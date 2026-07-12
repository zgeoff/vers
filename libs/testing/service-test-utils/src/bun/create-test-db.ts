import { makeTestDB } from './make-test-db';

/**
 * The repo's default test-DB factory: transaction isolation by default, schema isolation for code
 * that commits mid-op or continues after a caught constraint violation, database isolation for
 * database-scoped state and structures `LIKE` can't reproduce.
 */
export const createTestDB = makeTestDB({
  default: 'transaction',
  enabled: ['transaction', 'schema', 'database'],
});
