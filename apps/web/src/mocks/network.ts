import { createTestNetwork } from '@zgeoff/testing/fetch';
import { handlers } from './handlers';

// the mocked services answer at localhost origins, so only the numeric loopback hosts pass
// through to a stub server
export const network = createTestNetwork({
  handlers,
  passthroughHosts: ['127.0.0.1', '[::1]'],
});
