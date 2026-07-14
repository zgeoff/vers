import { buildContractMock } from '@vers/client-test-utils/orpc';
import { activityContract } from '@vers/contract-activity';
import { resolveServiceURL } from '../resolve-service-url';

/**
 * Per-procedure override proxy for the activity contract, at the same env-resolved origin the
 * stateful backend mounts on: `server.use(mockActivityService.<procedure>.handler(…))` shadows
 * that backend for one test.
 */
export const mockActivityService = buildContractMock({
  baseUrl: resolveServiceURL('activity'),
  contract: activityContract,
  resolveContext: () => ({}),
});
