import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { STACK_ARGS } from './stack-args';
import { ServiceID } from './types';

test('#start starts every service without a build or a recreate by default', () => {
  const resolved = resolveArgs(STACK_ARGS.start, parseArgs([]));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({ build: false, 'force-recreate': false });
});

test('#start reads the service and the short build and recreate flags', () => {
  const resolved = resolveArgs(STACK_ARGS.start, parseArgs(['service-activity', '-b', '-f']));

  expect({ ...resolved.values }).toStrictEqual({
    build: true,
    'force-recreate': true,
    service: ServiceID.ServiceActivity,
  });
});

test('#start reads the long build and recreate flags', () => {
  const resolved = resolveArgs(STACK_ARGS.start, parseArgs(['--build', '--force-recreate']));

  expect({ ...resolved.values }).toStrictEqual({ build: true, 'force-recreate': true });
});

test('#start rejects a service the stack lacks', () => {
  const resolved = resolveArgs(STACK_ARGS.start, parseArgs(['mailer']));

  expect(resolved.error?.errors).toPartiallyContain({
    message: expect.toStartWith('Invalid service "mailer"'),
  });
});

test.each([
  ['stop', STACK_ARGS.stop],
  ['rm', STACK_ARGS.rm],
  ['logs', STACK_ARGS.logs],
])('#%s acts on every service when it names none', (_command, args) => {
  const resolved = resolveArgs(args, parseArgs([]));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({});
});

test.each([
  ['stop', STACK_ARGS.stop],
  ['rm', STACK_ARGS.rm],
  ['logs', STACK_ARGS.logs],
])('#%s reads the service it names', (_command, args) => {
  const resolved = resolveArgs(args, parseArgs(['service-activity']));

  expect({ ...resolved.values }).toStrictEqual({ service: ServiceID.ServiceActivity });
});

test('#exec reads the service and the words of the command', () => {
  const resolved = resolveArgs(STACK_ARGS.exec, parseArgs(['service-activity', 'ls', '/app']));

  expect({ ...resolved.values }).toStrictEqual({
    command: ['ls', '/app'],
    service: ServiceID.ServiceActivity,
  });
});

test('#exec leaves the words after -- for the command', () => {
  const resolved = resolveArgs(STACK_ARGS.exec, parseArgs(['service-activity', '--', 'ls', '-la']));

  expect({ ...resolved.values }).toStrictEqual({ service: ServiceID.ServiceActivity });
  expect(resolved.rest).toStrictEqual(['ls', '-la']);
});

test('#exec requires the service', () => {
  const resolved = resolveArgs(STACK_ARGS.exec, parseArgs([]));

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:required-positional' });
});
