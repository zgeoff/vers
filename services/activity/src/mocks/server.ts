import { resolveServiceURL } from '@vers/mock-services';
import { buildReplayMockHandlers } from '@vers/mock-services/replay';
import { setupServer } from 'msw/node';

/**
 * Mocks the replay service — the sole external HTTP boundary this package's wake poke crosses.
 * Tests needing a different response override with `mockReplayService.<procedure>.handler(...)` via
 * `server.use(...)`.
 */
export const server = setupServer(...buildReplayMockHandlers(resolveServiceURL('replay')));
