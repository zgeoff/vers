import { resolveServiceURL } from '@vers/mock-services';
import { buildKeysMockHandlers } from '@vers/mock-services/keys';
import { buildReplayMockHandlers } from '@vers/mock-services/replay';
import { createTestNetwork } from '@zgeoff/testing/fetch';

// the replay handlers answer the wake the in-process activity service sends after an append
export const network = createTestNetwork({
  handlers: [
    ...buildKeysMockHandlers(resolveServiceURL('keys')),
    ...buildReplayMockHandlers(resolveServiceURL('replay')),
  ],
});
