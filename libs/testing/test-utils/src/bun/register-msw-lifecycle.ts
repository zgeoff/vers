import { afterAll, afterEach } from 'bun:test';
import type { SharedOptions } from 'msw';
import type { SetupServer } from 'msw/node';

interface RegisterMSWLifecycleOptions {
  readonly onUnhandledRequest?: SharedOptions['onUnhandledRequest'];
}

export function registerMSWLifecycle(
  server: SetupServer,
  options: Readonly<RegisterMSWLifecycleOptions> = {},
): void {
  server.listen({ onUnhandledRequest: options.onUnhandledRequest ?? 'error' });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });
}
