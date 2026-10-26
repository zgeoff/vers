import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { QA_RESET_ARGS } from './qa-reset-args';

test('it resets the progress of the account on a loopback host by default', () => {
  const resolved = resolveArgs(QA_RESET_ARGS, parseArgs(['--user', 'tester']));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({ all: false, user: 'tester', yes: false });
});

test('it reads the all and yes flags', () => {
  const resolved = resolveArgs(QA_RESET_ARGS, parseArgs(['--user', 'tester', '--all', '--yes']));

  expect({ ...resolved.values }).toStrictEqual({ all: true, user: 'tester', yes: true });
});

test('it requires the account name', () => {
  const resolved = resolveArgs(QA_RESET_ARGS, parseArgs([]));

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:required-option' });
});
