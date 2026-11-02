import { expect, test } from 'bun:test';
import { parseArgs, resolveArgs } from 'gunshi';
import { QA_CHROME_ARGS } from './qa-chrome-args';

test('it starts on the host network on port 9222 by default', () => {
  const resolved = resolveArgs(QA_CHROME_ARGS.start, parseArgs([]));

  expect(resolved.error).toBeUndefined();
  expect({ ...resolved.values }).toStrictEqual({ netns: false, port: 9222 });
});

test('it reads --netns and --port', () => {
  const resolved = resolveArgs(QA_CHROME_ARGS.start, parseArgs(['--netns', '--port=9333']));

  expect({ ...resolved.values }).toStrictEqual({ netns: true, port: 9333 });
});

test.each(['0', '70000', '92.5', 'auto'])('it rejects the port %s', (port) => {
  const resolved = resolveArgs(QA_CHROME_ARGS.start, parseArgs(['--port', port]));

  expect(resolved.error?.errors).toPartiallyContain({
    message: `expected a port from 1 to 65535, got "${port}"`,
  });
});
