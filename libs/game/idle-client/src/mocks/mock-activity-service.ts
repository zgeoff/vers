import { buildContractMock } from '@vers/client-test-utils/orpc';
import { activityContract } from '@vers/contract-activity';

/**
 * The origin the test activity client posts to; MSW intercepts every RPC call under it.
 */
export const ACTIVITY_SERVICE_URL = 'http://activity.test';

/**
 * A contract-typed proxy over the activities service. Each leaf's `.handler(mock)` builds a narrow
 * MSW handler a test registers with `server.use(...)`, resolving success payloads or throwing the
 * contract's own typed errors.
 */
export const mockActivityService = buildContractMock({
  baseUrl: ACTIVITY_SERVICE_URL,
  contract: activityContract,
  resolveContext: () => ({}),
});
