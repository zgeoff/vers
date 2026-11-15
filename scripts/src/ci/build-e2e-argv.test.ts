import { expect, test } from 'bun:test';
import { buildE2EArgv } from './build-e2e-argv';

test('it forwards each Playwright flag of a leg to the e2e script', () => {
  expect(buildE2EArgv('--project=chromium-renderer --no-deps  --shard=1/2')).toStrictEqual([
    'run',
    'e2e',
    '--affected',
    '--log-order=stream',
    '--',
    '--project=chromium-renderer',
    '--no-deps',
    '--shard=1/2',
  ]);
});

test('it forwards no flag for a leg with none', () => {
  expect(buildE2EArgv('')).toStrictEqual(['run', 'e2e', '--affected', '--log-order=stream', '--']);
});
