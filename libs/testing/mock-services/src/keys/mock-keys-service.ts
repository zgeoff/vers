import { buildContractMock } from '@vers/client-test-utils/orpc';
import { keysContract } from '@vers/contract-keys';
import { resolveServiceURL } from '../resolve-service-url';

export const mockKeysService = buildContractMock({
  baseUrl: resolveServiceURL('keys'),
  contract: keysContract,
  resolveContext: () => ({}),
});
