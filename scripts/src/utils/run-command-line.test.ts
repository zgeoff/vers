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

test('it refuses a positional word that no argument takes before the command runs', async () => {
  const ctx = setupTest();
  const run = mock(() => {});
  const stop = define({ args: { service: { type: 'positional' } }, name: 'stop', run });

  const ran = await runCommandLine(['stop', 'api', 'worker'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { stop },
  });

  expect(ran).toBeFalse();
  expect(run).not.toHaveBeenCalled();
  expect(ctx.output.error).toHaveBeenCalledExactlyOnceWith('tool: unexpected arguments: worker');
});

test('it fills the positional arguments from the words after --', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const insert = define({
    args: { target: { type: 'positional' }, text: { type: 'positional' } },
    name: 'insert',
    run: (command) => {
      received.push([command.values, command.rest]);
    },
  });

  const ran = await runCommandLine(['insert', 'T1', '--', '--hello'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { insert },
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual([[{ target: 'T1', text: '--hello' }, []]]);
});

test('it parses a positional word after -- with the argument parser', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const move = define({
    args: { x: { parse: Number, type: 'positional' } },
    name: 'move',
    run: (command) => {
      received.push(command.values.x);
    },
  });

  await runCommandLine(['move', '--', '-5'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { move },
  });

  expect(received).toStrictEqual([-5]);
});

test('it refuses a missing positional argument when the command line holds --', async () => {
  const ctx = setupTest();
  const run = mock(() => {});

  const insert = define({
    args: { target: { type: 'positional' }, text: { type: 'positional' } },
    name: 'insert',
    run,
  });

  const ran = await runCommandLine(['insert', '--', 'T1'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { insert },
  });

  expect(ran).toBeFalse();
  expect(run).not.toHaveBeenCalled();

  expect(ctx.output.error).toHaveBeenCalledExactlyOnceWith(
    "tool: Positional argument 'text' is required",
  );
});

test('it reads the arguments after an empty word before the command name', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const evaluate = define({
    args: { target: { type: 'positional' }, script: { type: 'positional' } },
    name: 'eval',
    run: (command) => {
      received.push({ ...command.values });
    },
  });

  const ran = await runCommandLine(['', 'eval', 'T1', '1+2'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { eval: evaluate },
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual([{ script: '1+2', target: 'T1' }]);
});

test('it reads a negative number as a positional argument', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const move = define({
    args: {
      x: { parse: Number, type: 'positional' },
      y: { parse: Number, type: 'positional' },
    },
    name: 'move',
    run: (command) => {
      received.push({ ...command.values });
    },
  });

  const ran = await runCommandLine(['move', '-5', '2'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { move },
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual([{ x: -5, y: 2 }]);
});

test('it reads a flag value that starts with -', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const entry = define({
    args: { offset: { parse: Number, type: 'custom' }, label: { type: 'string' } },
    name: 'tool',
    run: (command) => {
      received.push({ ...command.values });
    },
  });

  const ran = await runCommandLine(['--offset', '-3', '--label', '-draft'], entry, {
    output: ctx.output,
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual([{ label: '-draft', offset: -3 }]);
});

test('it reads a flag value that starts with - before the command name', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const wait = define({
    args: { label: { type: 'string' } },
    name: 'wait',
    run: (command) => {
      received.push(command.values.label);
    },
  });

  await runCommandLine(['--label', '-draft', 'wait'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { wait },
  });

  expect(received).toStrictEqual(['-draft']);
});

test('it reads a flag value before the command name when another command has a positional of the same name', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const monitor = define({
    args: { url: { type: 'string' } },
    name: 'monitor',
    run: (command) => {
      received.push(command.values.url);
    },
  });

  const nav = define({ args: { url: { type: 'positional' } }, name: 'nav', run: () => {} });

  const ran = await runCommandLine(['--url', '-preview', 'monitor'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { monitor, nav },
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual(['-preview']);
});

test('it still refuses a word that starts with - and is no number as an unknown flag', async () => {
  const ctx = setupTest();
  const run = mock(() => {});
  const move = define({ args: { x: { type: 'positional' } }, name: 'move', run });

  const ran = await runCommandLine(['move', '-left'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { move },
  });

  expect(ran).toBeFalse();
  expect(run).not.toHaveBeenCalled();
});

test('it reads the arguments of a command named after --', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const text = define({
    args: { target: { type: 'positional' } },
    name: 'text',
    run: (command) => {
      received.push({ ...command.values });
    },
  });

  const ran = await runCommandLine(['--', 'text', 'T1'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { text },
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual([{ target: 'T1' }]);
});

test('it refuses a surplus word after --', async () => {
  const ctx = setupTest();
  const run = mock(() => {});
  const stop = define({ args: { service: { type: 'positional' } }, name: 'stop', run });

  const ran = await runCommandLine(['stop', 'api', '--', 'worker'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { stop },
  });

  expect(ran).toBeFalse();
  expect(run).not.toHaveBeenCalled();
  expect(ctx.output.error).toHaveBeenCalledExactlyOnceWith('tool: unexpected arguments: worker');
});

test('it passes the words after -- to a command with a multiple positional argument', async () => {
  const ctx = setupTest();
  const received: Array<unknown> = [];

  const exec = define({
    args: { command: { multiple: true, type: 'positional' } },
    name: 'exec',
    run: (command) => {
      received.push([command.values.command, command.rest]);
    },
  });

  const ran = await runCommandLine(['exec', 'ls', '--', '-la'], define({ name: 'tool' }), {
    output: ctx.output,
    subCommands: { exec },
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual([[['ls'], ['-la']]]);
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
