import { defineTestDB } from './define-test-db';

/** The repo's default test-DB factory: transaction isolation, with database isolation opt-in. */
export const createTestDB = defineTestDB({
  default: 'transaction',
  enabled: ['transaction', 'database'],
});
