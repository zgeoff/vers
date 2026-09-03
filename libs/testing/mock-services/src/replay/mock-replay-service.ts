import { buildContractMock } from '@vers/client-test-utils/orpc';
import { replayContract } from '@vers/contract-replay';
import { resolveServiceURL } from '../resolve-service-url';

export const mockReplayService = buildContractMock({
  baseUrl: resolveServiceURL('replay'),
  contract: replayContract,
  resolveContext: () => ({}),
});
