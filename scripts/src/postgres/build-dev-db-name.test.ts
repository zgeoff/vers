import { expect, test } from 'bun:test';
import { buildDevDBName } from './build-dev-db-name';

test('it composes machine and branch into a prefixed identifier', () => {
  expect(buildDevDBName('devbox', 'main')).toBe('dev_devbox_main');
});

test('it sanitizes slashes, dots, and uppercase to underscores', () => {
  expect(buildDevDBName('Dev-Box.local', 'feat/476-pg-MCP')).toBe(
    'dev_dev_box_local_feat_476_pg_mcp',
  );
});

test('it caps the machine fragment independently of the branch', () => {
  const name = buildDevDBName('a'.repeat(40), 'main');

  expect(name).toBe(`dev_${'a'.repeat(16)}_main`);
});

test('it truncates a long name under the identifier limit with a hash suffix', () => {
  const name = buildDevDBName('devbox', `feat/${'x'.repeat(80)}`);

  expect(name.length).toBeLessThanOrEqual(63);
  expect(name).toStartWith('dev_devbox_feat_');
  expect(name).toMatch(/_[0-9a-f]{8}$/);
});

test('it keeps distinct long branches distinct after truncation', () => {
  const shared = `feat/${'x'.repeat(80)}`;
  const first = buildDevDBName('devbox', `${shared}a`);
  const second = buildDevDBName('devbox', `${shared}b`);

  expect(first).not.toBe(second);
});

test('it is deterministic', () => {
  expect(buildDevDBName('devbox', 'feat/476')).toBe(buildDevDBName('devbox', 'feat/476'));
});
