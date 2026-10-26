import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { CHECK_CONTENT_DIGEST_ARGS } from './check-content-digest-args';

test('it checks against no base ref by default', () => {
  const resolved = resolveArgs(CHECK_CONTENT_DIGEST_ARGS, parseArgs([]));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({});
});

test('it reads the base ref', () => {
  const resolved = resolveArgs(CHECK_CONTENT_DIGEST_ARGS, parseArgs(['--base', 'origin/main']));

  expect({ ...resolved.values }).toStrictEqual({ base: 'origin/main' });
});
