import { expect, onTestFinished, test } from 'bun:test';
import { sql } from 'kysely';
import { buildMigrationDB } from './build-migration-db';
import { resolveTestDBTarget } from './test-support/resolve-test-db-target';

test('it connects with no statement timeout, so a long migration step runs to the end', async () => {
  const db = buildMigrationDB({ databaseURL: `${resolveTestDBTarget().baseURI}/postgres` });

  onTestFinished(() => db.destroy());

  const result = await sql`SHOW statement_timeout`.execute(db);

  expect(result.rows).toStrictEqual([{ statementTimeout: '0' }]);
});
