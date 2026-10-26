import { expect, mock, test } from 'bun:test';
import { runCommandLine } from '@vers/scripts';
import { define, parseArgs, resolveArgs } from 'gunshi';
import { QA_SEED_ARGS } from './qa-seed-args';

test('it reads a password that starts with -', async () => {
  const received: Array<unknown> = [];
  const output = { error: mock((_text: string) => {}), log: mock((_text: string) => {}) };

  const entry = define({
    args: QA_SEED_ARGS,
    name: 'qa-seed',
    run: (ctx) => {
      received.push(ctx.values.password);
    },
  });

  const ran = await runCommandLine(
    ['--user', 'tester', '--level', '1', '--password', '-correct-horse'],
    entry,
    { output },
  );

  expect(ran).toBeTrue();
  expect(received).toStrictEqual(['-correct-horse']);
});

test('it reports a negative level through the level parser', async () => {
  const output = { error: mock((_text: string) => {}), log: mock((_text: string) => {}) };
  const entry = define({ args: QA_SEED_ARGS, name: 'qa-seed', run: () => {} });

  const ran = await runCommandLine(['--user', 'tester', '--level', '-2'], entry, { output });

  expect(ran).toBeFalse();

  expect(output.error).toHaveBeenCalledExactlyOnceWith(
    'qa-seed: expected an integer of at least 1, got "-2"',
  );
});

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
