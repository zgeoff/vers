import { resolveServiceURL } from '@vers/mock-services';
import { buildActivityMockHandlers } from '@vers/mock-services/activity';
import { setupServer } from 'msw/node';

/**
 * The shared MSW server backing this package's tests. The stateful activity backend is baked in,
 * so happy-path responses come from seeded mock-db rows; per-test handlers layer deviations on
 * top. Lifecycle is registered once from the bunfig preload.
 */
export const server = setupServer(...buildActivityMockHandlers(resolveServiceURL('activity')));
