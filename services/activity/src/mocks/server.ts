import { resolveServiceURL } from '@vers/mock-services';
import { buildKeysMockHandlers } from '@vers/mock-services/keys';
import { buildReplayMockHandlers } from '@vers/mock-services/replay';
import { setupServer } from 'msw/node';

/**
 * Mocks the keys and replay services — the external HTTP boundaries this package's start-time
 * scope-secret read and wake poke cross. Tests needing a different response override with
 * `mockKeysService.<procedure>.handler(...)` / `mockReplayService.<procedure>.handler(...)` via
 * `server.use(...)`.
 */
export const server = setupServer(
  ...buildKeysMockHandlers(resolveServiceURL('keys')),
  ...buildReplayMockHandlers(resolveServiceURL('replay')),
);
