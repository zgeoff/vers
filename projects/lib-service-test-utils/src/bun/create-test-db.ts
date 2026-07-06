import { makeTestDB } from './make-test-db';

/** The repo's default test-DB factory: transaction isolation, with database isolation opt-in. */
export const createTestDB = makeTestDB({
  default: 'transaction',
  enabled: ['transaction', 'database'],
});
