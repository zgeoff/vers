import { expect, test } from 'bun:test';
import { createId } from '@paralleldrive/cuid2';
import postgres from 'postgres';
import { createDB } from '../create-db';
import { provisionTestTemplate } from './provision-test-template';
import { resolveTestDBTarget } from './resolve-test-db-target';

test('it creates and migrates a template database that does not exist yet', async () => {
  const baseURI = resolveTestDBTarget().baseURI;
  const templateDB = `test_template_provision_${createId()}`;

  await provisionTestTemplate({ baseURI, templateDB });

  const db = createDB({ databaseURL: `${baseURI}/${templateDB}` });

  const inserted = await db
    .insertInto('users')
    .values({
      email: 'provision-test-template@test.com',
      id: 'usr_provision_test_template',
      name: 'Provision Test Template',
      username: 'provision_test_template',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  expect(inserted.createdAt).toBeInstanceOf(Date);

  await db.destroy();
});

test('it is a no-op the second time against an already-current template', async () => {
  const baseURI = resolveTestDBTarget().baseURI;
  const templateDB = `test_template_provision_${createId()}`;

  await provisionTestTemplate({ baseURI, templateDB });
  await expect(provisionTestTemplate({ baseURI, templateDB })).toResolve();
});

test('it serializes concurrent provisioning of the same template name', async () => {
  const baseURI = resolveTestDBTarget().baseURI;
  const templateDB = `test_template_provision_${createId()}`;

  await Promise.all([
    provisionTestTemplate({ baseURI, templateDB }),
    provisionTestTemplate({ baseURI, templateDB }),
    provisionTestTemplate({ baseURI, templateDB }),
  ]);

  const admin = postgres(`${baseURI}/postgres`);

  const rows = await admin`SELECT 1 FROM pg_database WHERE datname = ${templateDB}`;

  expect(rows).toHaveLength(1);

  await admin.end();
});

test('it rejects a template name that is not a safe identifier', () => {
  const promise = provisionTestTemplate({
    baseURI: resolveTestDBTarget().baseURI,
    templateDB: 'test_template; DROP DATABASE postgres;',
  });

  expect(promise).rejects.toThrow('invalid test-template database name');
});
