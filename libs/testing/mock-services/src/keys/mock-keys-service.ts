import { buildContractMock } from '@vers/client-test-utils/orpc';
import { keysContract } from '@vers/contract-keys';
import { resolveServiceURL } from '../resolve-service-url';

/**
 * Per-procedure override proxy for the keys contract, at the same env-resolved origin the mock
 * backend mounts on: `server.use(mockKeysService.<procedure>.handler(…))` shadows that backend
 * for one test.
 */
export const mockKeysService = buildContractMock({
  baseUrl: resolveServiceURL('keys'),
  contract: keysContract,
  resolveContext: () => ({}),
});
