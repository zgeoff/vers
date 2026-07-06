import { expect, test } from 'bun:test';
import { createDB } from '@vers/db';
import { cloneTemplateDatabase, resolveTestDBTarget } from './clone-database';

test('it resolves the base URI and template db name published by setupBunTestDB', () => {
  const target = resolveTestDBTarget();

  expect(target.baseURI).toStartWith('postgres://');
  expect(target.templateDB).not.toBeEmpty();
});

test('it falls back to the fixed test-container defaults when the env vars are unset', () => {
  const originalURI = process.env['TEST_DB_URI'];
  const originalTemplate = process.env['TEST_TEMPLATE_DB'];

  delete process.env['TEST_DB_URI'];
  delete process.env['TEST_TEMPLATE_DB'];

  try {
    expect(resolveTestDBTarget()).toStrictEqual({
      baseURI: 'postgres://test:test@localhost:32999',
      templateDB: 'test_template',
    });
  } finally {
    if (originalURI !== undefined) {
      process.env['TEST_DB_URI'] = originalURI;
    }

    if (originalTemplate !== undefined) {
      process.env['TEST_TEMPLATE_DB'] = originalTemplate;
    }
  }
});

test('it clones the migrated template into a freshly named, independently connectable database', async () => {
  const databaseURL = await cloneTemplateDatabase();

  expect(databaseURL).toInclude('test_');

  await using db = createDB({ databaseURL });
  const rows = await db.selectFrom('users').selectAll().execute();

  expect(rows).toBeEmpty();
});

test('it clones a distinct database on every call', async () => {
  const [first, second] = await Promise.all([cloneTemplateDatabase(), cloneTemplateDatabase()]);

  expect(first).not.toBe(second);
});
