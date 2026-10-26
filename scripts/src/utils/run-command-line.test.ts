import { expect, mock, test } from 'bun:test';
import { define } from 'gunshi';
import { runCommandLine } from './run-command-line';

function setupTest() {
  const output = { error: mock((_text: string) => {}), log: mock((_text: string) => {}) };

  return { output };
}

test('it runs the command the command line names with its parsed flags', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const wait = define({
    args: { seconds: { default: 10, type: 'number' } },
    name: 'wait',
    run: (command) => {
      received.push(command.values);
    },
  });

  const ran = await runCommandLine(['wait', '--seconds', '3'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { wait },
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual([{ seconds: 3 }]);
});

test('it takes a flag the command declares before the command name', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const wait = define({
    args: { endpoint: { type: 'string' } },
    name: 'wait',
    run: (command) => {
      received.push(command.values.endpoint);
    },
  });

  await runCommandLine(['--endpoint', 'host:1', 'wait'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { wait },
  });

  expect(received).toStrictEqual(['host:1']);
});

test('it refuses an unknown flag before the command runs', async () => {
  const ctx = setupTest();
  const run = mock(() => {});

  const ran = await runCommandLine(['--bogus'], define({ name: 'tool', run }), {
    output: ctx.output,
  });

  expect(ran).toBeFalse();
  expect(run).not.toHaveBeenCalled();
  expect(ctx.output.error).toHaveBeenCalledExactlyOnceWith('tool: Unknown option: --bogus');
});

test('it reports the message a flag parser throws', async () => {
  const ctx = setupTest();

  const entry = define({
    args: {
      limit: {
        parse: (value: string) => {
          throw new Error(`expected a limit, got "${value}"`);
        },
        type: 'custom',
      },
    },
    name: 'tool',
    run: () => {},
  });

  const ran = await runCommandLine(['--limit', 'many'], entry, { output: ctx.output });

  expect(ran).toBeFalse();
  expect(ctx.output.error).toHaveBeenCalledExactlyOnceWith('tool: expected a limit, got "many"');
});

test('it refuses a command name the tree lacks', async () => {
  const ctx = setupTest();

  const ran = await runCommandLine(['launch'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { wait: define({ name: 'wait', run: () => {} }) },
  });

  expect(ran).toBeFalse();
  expect(ctx.output.error).toHaveBeenCalledExactlyOnceWith('tool: Command not found: launch');
});

test('it prints the usage and fails when a command tree is given no command', async () => {
  const ctx = setupTest();

  const ran = await runCommandLine([], define({ description: 'a tool', name: 'tool' }), {
    output: ctx.output,
    subCommands: { wait: define({ description: 'wait a while', name: 'wait', run: () => {} }) },
  });

  expect(ran).toBeFalse();
  expect(ctx.output.log).toHaveBeenCalledExactlyOnceWith(expect.toInclude('wait a while'));
  expect(ctx.output.error).toHaveBeenCalledExactlyOnceWith('tool: name a command');
});

test('it prints the usage of a command for --help', async () => {
  const ctx = setupTest();
  const run = mock(() => {});

  const entry = define({
    args: { seconds: { description: 'seconds to wait', type: 'number' } },
    name: 'tool',
    run,
  });

  const ran = await runCommandLine(['--help'], entry, { output: ctx.output });

  expect(ran).toBeTrue();
  expect(run).not.toHaveBeenCalled();
  expect(ctx.output.log).toHaveBeenCalledExactlyOnceWith(expect.toInclude('seconds to wait'));
});

test('it rethrows an error the command throws', () => {
  const ctx = setupTest();

  const entry = define({
    name: 'tool',
    run: () => {
      throw new Error('the database is down');
    },
  });

  expect(runCommandLine([], entry, { output: ctx.output })).rejects.toThrowWithMessage(
    Error,
    'the database is down',
  );
});
