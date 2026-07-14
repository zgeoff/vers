import { expect, test } from 'bun:test';
import { buildAdvisoryLockKey } from './build-advisory-lock-key';

test('it returns the same key for the same name', () => {
  expect(buildAdvisoryLockKey('test_template_main')).toBe(
    buildAdvisoryLockKey('test_template_main'),
  );
});

test('it returns distinct keys for distinct names', () => {
  const first = buildAdvisoryLockKey('test_template_main');
  const second = buildAdvisoryLockKey('test_template_feat_476_pg_mcp');

  expect(first).not.toBe(second);
});
