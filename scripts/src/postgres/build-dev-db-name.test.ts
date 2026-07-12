import { expect, test } from 'bun:test';
import { buildDevDBName } from './build-dev-db-name';

test('it composes machine and branch into a prefixed identifier', () => {
  expect(buildDevDBName('geoffbox', 'main')).toBe('dev_geoffbox_main');
});

test('it sanitizes slashes, dots, and uppercase to underscores', () => {
  expect(buildDevDBName('Geoff-Box.local', 'feat/476-pg-MCP')).toBe(
    'dev_geoff_box_local_feat_476_pg_mcp',
  );
});

test('it caps the machine fragment independently of the branch', () => {
  const name = buildDevDBName('a'.repeat(40), 'main');

  expect(name).toBe(`dev_${'a'.repeat(16)}_main`);
});

test('it truncates a long name under the identifier limit with a hash suffix', () => {
  const name = buildDevDBName('geoffbox', `feat/${'x'.repeat(80)}`);

  expect(name.length).toBeLessThanOrEqual(63);
  expect(name).toStartWith('dev_geoffbox_feat_');
  expect(name).toMatch(/_[0-9a-f]{8}$/);
});

test('it keeps distinct long branches distinct after truncation', () => {
  const shared = `feat/${'x'.repeat(80)}`;
  const first = buildDevDBName('geoffbox', `${shared}a`);
  const second = buildDevDBName('geoffbox', `${shared}b`);

  expect(first).not.toBe(second);
});

test('it is deterministic', () => {
  expect(buildDevDBName('geoffbox', 'feat/476')).toBe(buildDevDBName('geoffbox', 'feat/476'));
});
