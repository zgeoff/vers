import { afterAll, afterEach } from 'bun:test';
import type { SharedOptions } from 'msw';
import type { SetupServer } from 'msw/node';

interface RegisterMSWLifecycleOptions {
  /**
   * Overrides how an unhandled request is treated; defaults to `'error'`. A caller whose suites
   * dispatch real HTTP to origins with no mock handler passes a predicate that bypasses those and
   * errors on everything else.
   */
  readonly onUnhandledRequest?: SharedOptions['onUnhandledRequest'];
}

/**
 * Wires an MSW server's lifecycle into the current bun-test run: starts it (erroring on any
 * unhandled request by default), resets handlers after each test, closes after all. Call once from
 * a bunfig preload — `bun test` runs every file in one process, so these hooks apply suite-wide.
 * Test files then add per-test handlers with `server.use(...)`.
 */
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
