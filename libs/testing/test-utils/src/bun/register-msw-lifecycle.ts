import { afterAll, afterEach } from 'bun:test';
import type { SetupServer } from 'msw/node';

/**
 * Wires an MSW server's lifecycle into the current bun-test run: starts it (erroring on any
 * unhandled request), resets handlers after each test, closes after all. Call once from a bunfig
 * preload — `bun test` runs every file in one process, so these hooks apply suite-wide. Test files
 * then add per-test handlers with `server.use(...)`.
 */
export function registerMSWLifecycle(server: SetupServer): void {
  server.listen({ onUnhandledRequest: 'error' });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });
}
