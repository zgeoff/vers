import { makeTestDB } from './make-test-db';

export const createTestDB = makeTestDB({
  default: 'transaction',
  enabled: ['transaction', 'schema', 'database'],
});
