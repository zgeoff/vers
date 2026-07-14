import { expect, test } from 'bun:test';
import { buildTestTemplateDBName } from './build-test-template-db-name';

test('it prefixes the normalized branch name', () => {
  expect(buildTestTemplateDBName('main')).toBe('test_template_main');
});

test('it sanitizes slashes, dots, and uppercase to underscores', () => {
  expect(buildTestTemplateDBName('feat/476-pg-MCP')).toBe('test_template_feat_476_pg_mcp');
});

test('it truncates a long name under the identifier limit with a hash suffix', () => {
  const name = buildTestTemplateDBName(`feat/${'x'.repeat(80)}`);

  expect(name.length).toBeLessThanOrEqual(63);
  expect(name).toStartWith('test_template_feat_');
  expect(name).toMatch(/_[0-9a-f]{8}$/);
});

test('it keeps distinct long branches distinct after truncation', () => {
  const shared = `feat/${'x'.repeat(80)}`;
  const first = buildTestTemplateDBName(`${shared}a`);
  const second = buildTestTemplateDBName(`${shared}b`);

  expect(first).not.toBe(second);
});

test('it is deterministic', () => {
  expect(buildTestTemplateDBName('feat/551')).toBe(buildTestTemplateDBName('feat/551'));
});
