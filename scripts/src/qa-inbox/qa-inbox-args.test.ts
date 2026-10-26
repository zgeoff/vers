import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { QA_INBOX_ARGS } from './qa-inbox-args';

test('#wait reads any template for 120 seconds as text by default', () => {
  const resolved = resolveArgs(QA_INBOX_ARGS.wait, parseArgs(['--to', 'qa@example.test']));

  expect(resolved.error).toBeUndefined();

  expect({ ...resolved.values }).toStrictEqual({
    json: false,
    kind: 'any',
    timeout: 120,
    to: 'qa@example.test',
  });
});

test('#wait reads the kind, the timeout and the json flag', () => {
  const resolved = resolveArgs(
    QA_INBOX_ARGS.wait,
    parseArgs(['--to', 'qa@example.test', '--kind', 'two-factor', '--timeout', '30', '--json']),
  );

  expect({ ...resolved.values }).toStrictEqual({
    json: true,
    kind: 'two-factor',
    timeout: 30,
    to: 'qa@example.test',
  });
});

test('#wait requires the recipient address', () => {
  const resolved = resolveArgs(QA_INBOX_ARGS.wait, parseArgs([]));

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:required-option' });
});

test('#wait rejects a kind outside the templates', () => {
  const resolved = resolveArgs(
    QA_INBOX_ARGS.wait,
    parseArgs(['--to', 'qa@example.test', '--kind', 'newsletter']),
  );

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:invalid-choice' });
});

test('#wait rejects a timeout that is not a number of seconds', () => {
  const resolved = resolveArgs(
    QA_INBOX_ARGS.wait,
    parseArgs(['--to', 'qa@example.test', '--timeout', 'later']),
  );

  expect(resolved.error?.errors).toPartiallyContain({
    message: 'expected a non-negative number of seconds, got "later"',
  });
});

test('#list prints 20 emails to any address by default', () => {
  const resolved = resolveArgs(QA_INBOX_ARGS.list, parseArgs([]));

  expect({ ...resolved.values }).toStrictEqual({ limit: 20 });
});

test('#list reads the address and the limit', () => {
  const resolved = resolveArgs(
    QA_INBOX_ARGS.list,
    parseArgs(['--to', 'qa@example.test', '--limit', '100']),
  );

  expect({ ...resolved.values }).toStrictEqual({ limit: 100, to: 'qa@example.test' });
});

test.each(['0', '101', '2.5', 'all'])('#list rejects the limit %s', (limit) => {
  const resolved = resolveArgs(QA_INBOX_ARGS.list, parseArgs(['--limit', limit]));

  expect(resolved.error?.errors).toPartiallyContain({
    message: `expected an integer from 1 to 100, got "${limit}"`,
  });
});

test('#show reads the email id as text by default', () => {
  const resolved = resolveArgs(QA_INBOX_ARGS.show, parseArgs(['email-1']));

  expect({ ...resolved.values }).toStrictEqual({ id: 'email-1', json: false });
});

test('#show reads the json flag', () => {
  const resolved = resolveArgs(QA_INBOX_ARGS.show, parseArgs(['email-1', '--json']));

  expect({ ...resolved.values }).toStrictEqual({ id: 'email-1', json: true });
});

test('#show requires the email id', () => {
  const resolved = resolveArgs(QA_INBOX_ARGS.show, parseArgs([]));

  expect(resolved.error?.errors).toPartiallyContain({ code: 'err:arg:required-positional' });
});
