import { resolveServiceURL } from '@vers/mock-services';
import { buildKeysMockHandlers } from '@vers/mock-services/keys';
import { buildReplayMockHandlers } from '@vers/mock-services/replay';
import { createTestNetwork } from '@zgeoff/testing/fetch';

// the mocked services answer at localhost origins, so only the numeric loopback hosts pass
// through to a stub server
export const network = createTestNetwork({
  handlers: [
    ...buildKeysMockHandlers(resolveServiceURL('keys')),
    ...buildReplayMockHandlers(resolveServiceURL('replay')),
  ],
  passthroughHosts: ['127.0.0.1', '[::1]'],
});
