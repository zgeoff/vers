import { resolveServiceURL } from '@vers/mock-services';
import { buildActivityMockHandlers } from '@vers/mock-services/activity';
import { createTestNetwork } from '@zgeoff/testing/fetch';

export const network = createTestNetwork({
  handlers: buildActivityMockHandlers(resolveServiceURL('activity')),
});
