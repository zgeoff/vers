import { resolveServiceURL } from '@vers/mock-services';
import { buildActivityMockHandlers } from '@vers/mock-services/activity';
import { createTestNetwork } from '@zgeoff/testing/fetch';

// the mocked services answer at localhost origins, so only the numeric loopback hosts pass
// through to a stub server
export const network = createTestNetwork({
  handlers: buildActivityMockHandlers(resolveServiceURL('activity')),
  passthroughHosts: ['127.0.0.1', '[::1]'],
});
