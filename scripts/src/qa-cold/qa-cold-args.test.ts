import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { QA_COLD_ARGS } from './qa-cold-args';

test('it acts once without waiting, a dry run or a force by default', () => {
  const resolved = resolveArgs(QA_COLD_ARGS, parseArgs([]));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({ 'dry-run': false, force: false, wait: false });
});

test('it reads the wait, dry run and force flags', () => {
  const resolved = resolveArgs(QA_COLD_ARGS, parseArgs(['--wait', '--dry-run', '--force']));

  expect({ ...resolved.values }).toStrictEqual({ 'dry-run': true, force: true, wait: true });
});
