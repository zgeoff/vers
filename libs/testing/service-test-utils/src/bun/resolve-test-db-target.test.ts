import { expect, test } from 'bun:test';
import { resolveTestDBTarget } from './resolve-test-db-target';

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
