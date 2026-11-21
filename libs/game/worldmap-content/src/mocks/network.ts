import { resolveServiceURL } from '@vers/mock-services';
import { buildKeysMockHandlers } from '@vers/mock-services/keys';
import { createTestNetwork } from '@zgeoff/testing/fetch';

export const network = createTestNetwork({
  handlers: buildKeysMockHandlers(resolveServiceURL('keys')),
});
