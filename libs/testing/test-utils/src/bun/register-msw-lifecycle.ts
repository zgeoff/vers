import { afterAll, afterEach, beforeAll } from 'bun:test';
import type { SharedOptions } from 'msw';
import type { SetupServer } from 'msw/node';

interface RegisterMSWLifecycleOptions {
  readonly onUnhandledRequest?: SharedOptions['onUnhandledRequest'];
}

export function registerMSWLifecycle(
  server: SetupServer,
  options: Readonly<RegisterMSWLifecycleOptions> = {},
): void {
  // a preload's body runs once per worker, but under `--parallel --no-isolate` its all-hooks fire
  // around every file: a listen in the body would stay closed after the first file's afterAll
  beforeAll(() => {
    server.listen({ onUnhandledRequest: options.onUnhandledRequest ?? 'error' });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });
}
