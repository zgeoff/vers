import { expect, onTestFinished, test } from 'bun:test';
import { Command } from 'commander';
import { buildEndpointOption } from './build-endpoint-option';

function setupTest(env: string | undefined): Command {
  const previous = process.env['QA_CDP_ENDPOINT'];

  onTestFinished(() => {
    if (previous === undefined) {
      delete process.env['QA_CDP_ENDPOINT'];
    } else {
      process.env['QA_CDP_ENDPOINT'] = previous;
    }
  });

  if (env === undefined) {
    delete process.env['QA_CDP_ENDPOINT'];
  } else {
    process.env['QA_CDP_ENDPOINT'] = env;
  }

  return new Command()
    .exitOverride()
    .configureOutput({ writeErr: () => {} })
    .addOption(buildEndpointOption());
}

test('it falls back to the local debug port when the environment names no endpoint', () => {
  const program = setupTest(undefined);

  program.parse([], { from: 'user' });

  expect(program.opts()).toStrictEqual({ endpoint: '127.0.0.1:9222' });
});

test('it takes a valid endpoint from the environment', () => {
  const program = setupTest('172.28.80.1:9223');

  program.parse([], { from: 'user' });

  expect(program.opts()).toStrictEqual({ endpoint: '172.28.80.1:9223' });
});

test('it rejects an invalid endpoint from the environment before any command runs', () => {
  const program = setupTest('127.0.0.1:9222/json');

  expect(() => program.parse([], { from: 'user' })).toThrowWithMessage(
    Error,
    /from env 'QA_CDP_ENDPOINT' is invalid\. expected host:port/,
  );
});

test('it lets the flag override the environment', () => {
  const program = setupTest('172.28.80.1:9223');

  program.parse(['--endpoint', '127.0.0.1:9333'], { from: 'user' });

  expect(program.opts()).toStrictEqual({ endpoint: '127.0.0.1:9333' });
});
