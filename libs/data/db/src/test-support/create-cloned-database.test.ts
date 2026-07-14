import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { createClonedDatabase } from './create-cloned-database';
import { createTestTemplate } from './create-test-template';
import { resolveTestDBTarget } from './resolve-test-db-target';

test('it clones a database from an already-migrated template', async () => {
  const baseURI = resolveTestDBTarget().baseURI;
  const templateDB = `test_template_clone_${createId()}`;
  const dbName = `test_clone_${createId()}`;

  await createTestTemplate({ baseURI, templateDB });
  await createClonedDatabase({ baseURI, templateDB, dbName });

  const admin = postgres(`${baseURI}/postgres`);

  const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;

  expect(rows).toHaveLength(1);

  await admin.end();
});

test('it rejects a template or database name that is not a safe identifier', () => {
  const baseURI = resolveTestDBTarget().baseURI;

  const unsafeTemplate = createClonedDatabase({
    baseURI,
    dbName: `test_clone_${createId()}`,
    templateDB: 'test_template; DROP DATABASE postgres;',
  });

  expect(unsafeTemplate).rejects.toThrow('invalid database identifier');

  const unsafeDBName = createClonedDatabase({
    baseURI,
    dbName: 'test_clone; DROP DATABASE postgres;',
    templateDB: 'test_template',
  });

  expect(unsafeDBName).rejects.toThrow('invalid database identifier');
});
