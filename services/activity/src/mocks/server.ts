import { resolveServiceURL } from '@vers/mock-services';
import { buildKeysMockHandlers } from '@vers/mock-services/keys';
import { buildReplayMockHandlers } from '@vers/mock-services/replay';
import { setupServer } from 'msw/node';

export const server = setupServer(
  ...buildKeysMockHandlers(resolveServiceURL('keys')),
  ...buildReplayMockHandlers(resolveServiceURL('replay')),
);
