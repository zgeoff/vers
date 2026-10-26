import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { QA_SEED_ARGS } from './qa-seed-args';

test('it seeds no runs, no two-factor and a generated password by default', () => {
  const resolved = resolveArgs(QA_SEED_ARGS, parseArgs(['--user', 'tester', '--level', '5']));

  expect(resolved.error).toBeUndefined();

  expect({ ...resolved.values }).toStrictEqual({
    level: 5,
    runs: 0,
    'two-factor': false,
    user: 'tester',
    yes: false,
  });
});

test('it reads the runs, two-factor, password and yes flags', () => {
  const resolved = resolveArgs(
    QA_SEED_ARGS,
    parseArgs([
      '--user',
      'tester',
      '--level',
      '1',
      '--runs',
      '3',
      '--two-factor',
      '--password',
      'correct horse',
      '--yes',
    ]),
  );

  expect({ ...resolved.values }).toStrictEqual({
    level: 1,
    password: 'correct horse',
    runs: 3,
    'two-factor': true,
    user: 'tester',
    yes: true,
  });
});

test('it requires the account name', () => {
  const resolved = resolveArgs(QA_SEED_ARGS, parseArgs(['--level', '5']));

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:required-option' });
});

test('it requires the avatar level', () => {
  const resolved = resolveArgs(QA_SEED_ARGS, parseArgs(['--user', 'tester']));

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:required-option' });
});

test('it rejects a level below 1', () => {
  const resolved = resolveArgs(QA_SEED_ARGS, parseArgs(['--user', 'tester', '--level', '0']));

  expect(resolved.error?.errors).toPartiallyContain({
    message: 'expected an integer of at least 1, got "0"',
  });
});

test('it accepts zero runs', () => {
  const resolved = resolveArgs(
    QA_SEED_ARGS,
    parseArgs(['--user', 'tester', '--level', '1', '--runs', '0']),
  );

  expect(resolved.values.runs).toBe(0);
});

test('it rejects a fraction of a run', () => {
  const resolved = resolveArgs(
    QA_SEED_ARGS,
    parseArgs(['--user', 'tester', '--level', '1', '--runs', '1.5']),
  );

  expect(resolved.error?.errors).toPartiallyContain({
    message: 'expected an integer of at least 0, got "1.5"',
  });
});
