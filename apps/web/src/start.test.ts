import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { readServerFnResponse } from './lib/offline/read-server-fn-response';
import { startInstance } from './start';

test('it registers the cross-site request check for server functions', async () => {
  const options = await startInstance.getOptions();

  const middleware = options.requestMiddleware?.[0];

  invariant(middleware, 'a request middleware is registered');

  expect(Symbol.for('tanstack-start:csrf-middleware') in middleware).toBe(true);
});

test('it sends every server function call through the fetch that marks a network failure', async () => {
  const options = await startInstance.getOptions();

  expect(options.serverFns?.fetch).toBe(readServerFnResponse);
});
