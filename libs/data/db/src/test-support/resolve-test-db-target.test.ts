import { expect, test } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import { buildTestTemplateDBName } from './build-test-template-db-name';
import { readCurrentBranch } from './read-current-branch';
import { resolveTestDBTarget } from './resolve-test-db-target';

test('it resolves the base URI and template db name published by the test-setup preload', () => {
  const target = resolveTestDBTarget();

  expect(target.baseURI).toStartWith('postgres://');
  expect(target.templateDB).not.toBeEmpty();
});

test('it falls back to the fixed container URI and the branch-scoped template name when the env vars are unset', () => {
  updateEnv('TEST_DB_URI', undefined);
  updateEnv('TEST_TEMPLATE_DB', undefined);

  expect(resolveTestDBTarget()).toStrictEqual({
    baseURI: 'postgres://test:test@localhost:32999',
    templateDB: buildTestTemplateDBName(readCurrentBranch()),
  });
});
