import { expect, mock, test } from 'bun:test';
import { define, parseArgs, resolveArgs } from 'gunshi';
import type { Args } from 'gunshi';
import { runCommandLine } from '../utils/run-command-line';
import { QA_CDP_ARGS } from './qa-cdp-args';

test.each<[string, Args, Array<string>, Record<string, unknown>]>([
  ['new', QA_CDP_ARGS.new, ['--', 'https://example.test/'], { url: 'https://example.test/' }],
  ['ctx', QA_CDP_ARGS.ctx, ['--', '-T1'], { target: '-T1' }],
  ['close', QA_CDP_ARGS.close, ['--', '-T1'], { target: '-T1' }],
  [
    'nav',
    QA_CDP_ARGS.nav,
    ['T1', '--', '-https://example.test/'],
    { target: 'T1', url: '-https://example.test/' },
  ],
  ['reload', QA_CDP_ARGS.reload, ['--', '-T1'], { target: '-T1' }],
  ['eval', QA_CDP_ARGS.eval, ['T1', '--', '-1 + 2'], { script: '-1 + 2', target: 'T1' }],
  ['text', QA_CDP_ARGS.text, ['--', '-T1'], { target: '-T1' }],
  ['shot', QA_CDP_ARGS.shot, ['T1', '--', '-out.png'], { file: '-out.png', target: 'T1' }],
  [
    'type',
    QA_CDP_ARGS.type,
    ['T1', '#name', '--', '--hello'],
    { selector: '#name', target: 'T1', text: '--hello' },
  ],
  [
    'insert',
    QA_CDP_ARGS.insert,
    ['T1', '--', '#name', '-x'],
    { selector: '#name', target: 'T1', text: '-x' },
  ],
  ['key', QA_CDP_ARGS.key, ['T1', '--', '-'], { key: '-', target: 'T1' }],
  ['click', QA_CDP_ARGS.click, ['T1', '--', '-5', '10'], { target: 'T1', x: -5, y: 10 }],
  [
    'console',
    QA_CDP_ARGS.console,
    ['--seconds', '3', '--', '-T1'],
    { reload: false, seconds: 3, target: '-T1' },
  ],
  ['offline', QA_CDP_ARGS.offline, ['T1', '--', 'off'], { state: 'off', target: 'T1' }],
  ['pause', QA_CDP_ARGS.pause, ['--', '-T1'], { target: '-T1' }],
  ['profile', QA_CDP_ARGS.profile, ['--', '-T1'], { seconds: 4, target: '-T1' }],
])('it fills the arguments of %s from the words after --', async (name, args, argv, expected) => {
  const received: Array<unknown> = [];
  const output = { error: mock((_text: string) => {}), log: mock((_text: string) => {}) };

  const command = define({
    args,
    name,
    run: (ctx) => {
      received.push({ ...ctx.values });
    },
  });

  const ran = await runCommandLine([name, ...argv], define({ name: 'qa-cdp' }), {
    output,
    subCommands: { [name]: command },
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual([expected]);
});

test.each<[string, Args, Array<string>, Record<string, unknown>]>([
  ['click', QA_CDP_ARGS.click, ['T1', '-5', '10'], { target: 'T1', x: -5, y: 10 }],
  ['click', QA_CDP_ARGS.click, ['T1', '12', '-0.5'], { target: 'T1', x: 12, y: -0.5 }],
  [
    'click',
    QA_CDP_ARGS.click,
    ['T1', '-5', '-10', '--endpoint', '127.0.0.1:9333'],
    { endpoint: '127.0.0.1:9333', target: 'T1', x: -5, y: -10 },
  ],
  ['eval', QA_CDP_ARGS.eval, ['T1', '-1'], { script: '-1', target: 'T1' }],
  [
    'monitor',
    QA_CDP_ARGS.monitor,
    ['--url', '-preview.example.test'],
    { every: 10, url: '-preview.example.test' },
  ],
  ['new', QA_CDP_ARGS.new, ['--context', '-CTX1'], { context: '-CTX1', url: 'about:blank' }],
])('it reads a value of %s that starts with -', async (name, args, argv, expected) => {
  const received: Array<unknown> = [];
  const output = { error: mock((_text: string) => {}), log: mock((_text: string) => {}) };

  const command = define({
    args,
    name,
    run: (ctx) => {
      received.push({ ...ctx.values });
    },
  });

  const ran = await runCommandLine([name, ...argv], define({ name: 'qa-cdp' }), {
    output,
    subCommands: { [name]: command },
  });

  expect(ran).toBeTrue();
  expect(received).toStrictEqual([expected]);
});

test('it leaves the endpoint unset when no flag names one', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.targets, parseArgs([]));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({});
});

test('it takes a valid endpoint flag', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.targets, parseArgs(['--endpoint', '127.0.0.1:9333']));

  expect({ ...resolved.values }).toStrictEqual({ endpoint: '127.0.0.1:9333' });
});

test('it rejects an endpoint flag that is not host:port', () => {
  const resolved = resolveArgs(
    QA_CDP_ARGS.targets,
    parseArgs(['--endpoint', 'http://127.0.0.1:9222']),
  );

  expect(resolved.error?.errors).toPartiallyContain({
    message: expect.toInclude('expected host:port'),
  });
});

test('it opens about:blank in a fresh context when new names no url', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.new, parseArgs([]));

  expect({ ...resolved.values }).toStrictEqual({ url: 'about:blank' });
});

test('it reads the url and the context of new', () => {
  const resolved = resolveArgs(
    QA_CDP_ARGS.new,
    parseArgs(['https://example.test/', '--context', 'CTX1']),
  );

  expect({ ...resolved.values }).toStrictEqual({ context: 'CTX1', url: 'https://example.test/' });
});

test('it polls every 10 seconds when monitor names no interval', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.monitor, parseArgs([]));

  expect({ ...resolved.values }).toStrictEqual({ every: 10 });
});

test('it reads the interval and the url filter of monitor', () => {
  const resolved = resolveArgs(
    QA_CDP_ARGS.monitor,
    parseArgs(['--every', '2.5', '--url', 'example.test']),
  );

  expect({ ...resolved.values }).toStrictEqual({ every: 2.5, url: 'example.test' });
});

test('it rejects a negative monitor interval', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.monitor, parseArgs(['--every=-1']));

  expect(resolved.error?.errors).toPartiallyContain({
    message: expect.toInclude('non-negative number of seconds'),
  });
});

test('it collects console output for 10 seconds without a reload by default', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.console, parseArgs(['T1']));

  expect({ ...resolved.values }).toStrictEqual({ reload: false, seconds: 10, target: 'T1' });
});

test('it reads the seconds and the reload flag of console', () => {
  const resolved = resolveArgs(
    QA_CDP_ARGS.console,
    parseArgs(['T1', '--seconds', '3', '--reload']),
  );

  expect({ ...resolved.values }).toStrictEqual({ reload: true, seconds: 3, target: 'T1' });
});

test('it samples for 4 seconds when profile names no duration', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.profile, parseArgs(['T1']));

  expect({ ...resolved.values }).toStrictEqual({ seconds: 4, target: 'T1' });
});

test('it parses the click coordinates as numbers', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.click, parseArgs(['T1', '12.5', '40']));

  expect({ ...resolved.values }).toStrictEqual({ target: 'T1', x: 12.5, y: 40 });
});

test('it rejects a click coordinate that is not a number', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.click, parseArgs(['T1', 'left', '40']));

  expect(resolved.error?.errors).toPartiallyContain({ message: 'expected a number, got "left"' });
});

test.each(['on', 'off'])('it reads the offline state %s', (state) => {
  const resolved = resolveArgs(QA_CDP_ARGS.offline, parseArgs(['T1', state]));

  expect({ ...resolved.values }).toStrictEqual({ state, target: 'T1' });
});

test('it rejects an offline state other than on or off', () => {
  const resolved = resolveArgs(QA_CDP_ARGS.offline, parseArgs(['T1', 'maybe']));

  expect(resolved.error?.errors).toPartiallyContain({
    message: 'expected on or off, got "maybe"',
  });
});

test.each<[string, Args, Array<string>, Record<string, string>]>([
  ['ctx', QA_CDP_ARGS.ctx, ['T1'], { target: 'T1' }],
  ['close', QA_CDP_ARGS.close, ['T1'], { target: 'T1' }],
  [
    'nav',
    QA_CDP_ARGS.nav,
    ['T1', 'https://example.test/'],
    { target: 'T1', url: 'https://example.test/' },
  ],
  ['reload', QA_CDP_ARGS.reload, ['T1'], { target: 'T1' }],
  ['eval', QA_CDP_ARGS.eval, ['T1', '1 + 1'], { script: '1 + 1', target: 'T1' }],
  ['text', QA_CDP_ARGS.text, ['T1'], { target: 'T1' }],
  ['shot', QA_CDP_ARGS.shot, ['T1', 'out.png'], { file: 'out.png', target: 'T1' }],
  [
    'type',
    QA_CDP_ARGS.type,
    ['T1', '#name', 'hello'],
    { selector: '#name', target: 'T1', text: 'hello' },
  ],
  [
    'insert',
    QA_CDP_ARGS.insert,
    ['T1', '#name', 'hello'],
    { selector: '#name', target: 'T1', text: 'hello' },
  ],
  ['key', QA_CDP_ARGS.key, ['T1', 'Enter'], { key: 'Enter', target: 'T1' }],
  ['pause', QA_CDP_ARGS.pause, ['T1'], { target: 'T1' }],
])('it reads the arguments of %s in the order they are typed', (_command, args, argv, expected) => {
  const resolved = resolveArgs(args, parseArgs(argv));

  expect({ ...resolved.values }).toStrictEqual(expected);
});

test.each<[string, Args]>([
  ['ctx', QA_CDP_ARGS.ctx],
  ['nav', QA_CDP_ARGS.nav],
  ['type', QA_CDP_ARGS.type],
  ['click', QA_CDP_ARGS.click],
  ['offline', QA_CDP_ARGS.offline],
])('it requires every argument of %s', (_command, args) => {
  const resolved = resolveArgs(args, parseArgs([]));

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:required-positional' });
});
