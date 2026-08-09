import { resolveServiceURL } from '@vers/mock-services';
import { buildKeysMockHandlers } from '@vers/mock-services/keys';
import { setupServer } from 'msw/node';

/**
 * Mocks the keys service — the sole external HTTP boundary this package's secret read crosses.
 * Tests needing a different response override with `mockKeysService.<procedure>.handler(...)` via
 * `server.use(...)`.
 */
export const server = setupServer(...buildKeysMockHandlers(resolveServiceURL('keys')));
