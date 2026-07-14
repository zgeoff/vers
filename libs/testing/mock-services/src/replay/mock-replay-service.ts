import { buildContractMock } from '@vers/client-test-utils/orpc';
import { replayContract } from '@vers/contract-replay';
import { resolveServiceURL } from '../resolve-service-url';

/**
 * Per-procedure override proxy for the replay contract, at the same env-resolved origin the
 * canned backend mounts on: `server.use(mockReplayService.<procedure>.handler(…))` shadows that
 * backend for one test.
 */
export const mockReplayService = buildContractMock({
  baseUrl: resolveServiceURL('replay'),
  contract: replayContract,
  resolveContext: () => ({}),
});
