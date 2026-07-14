import { expect, test } from 'bun:test';
import { pickOrphanedTestTemplates } from './pick-orphaned-test-templates';

test('it drops templates whose branch no longer exists locally', () => {
  const orphans = pickOrphanedTestTemplates({
    branches: ['main'],
    dbNames: ['test_template_main', 'test_template_feat_deleted'],
  });

  expect(orphans).toStrictEqual(['test_template_feat_deleted']);
});

test('it keeps every template with a matching local branch', () => {
  const orphans = pickOrphanedTestTemplates({
    branches: ['main', 'feat/476-pg-mcp'],
    dbNames: ['test_template_main', 'test_template_feat_476_pg_mcp'],
  });

  expect(orphans).toBeEmpty();
});

test('it never touches the container bootstrap database or unrelated databases', () => {
  const orphans = pickOrphanedTestTemplates({
    branches: ['main'],
    dbNames: ['test_template', 'test_template_feat_gone', 'test_a1b2c3', 'postgres'],
  });

  expect(orphans).toStrictEqual(['test_template_feat_gone']);
});

test('it matches after branch-name sanitization', () => {
  const orphans = pickOrphanedTestTemplates({
    branches: [],
    dbNames: ['test_template_feat_476_pg_mcp'],
  });

  expect(orphans).toStrictEqual(['test_template_feat_476_pg_mcp']);
});
