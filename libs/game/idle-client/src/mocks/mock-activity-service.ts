import { buildContractMock } from '@vers/client-test-utils/orpc';
import { activityContract } from '@vers/contract-activity';

export const ACTIVITY_SERVICE_URL = 'http://activity.test';

export const mockActivityService = buildContractMock({
  baseUrl: ACTIVITY_SERVICE_URL,
  contract: activityContract,
  resolveContext: () => ({}),
});
