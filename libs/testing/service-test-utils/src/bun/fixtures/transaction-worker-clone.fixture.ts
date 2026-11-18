import { test } from 'bun:test';
import { sql } from 'kysely';
import { z } from 'zod';
import { createTransactionTestDB } from '../strategies/create-transaction-test-db';

// a probe test runs this in a child process; the package's own run never does
test('it acquires the worker database of the transaction strategy', async () => {
  await using handle = await createTransactionTestDB();

  const result = await sql`select current_database()`.execute(handle.db);

  const [row] = z.tuple([z.object({ currentDatabase: z.string() })]).parse(result.rows);

  console.log(`ACQUIRED_DATABASE:${row.currentDatabase}`);
});
