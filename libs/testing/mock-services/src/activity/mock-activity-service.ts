import { buildContractMock } from '@vers/client-test-utils/orpc';
import { activityContract } from '@vers/contract-activity';
import { resolveServiceURL } from '../resolve-service-url';

export const mockActivityService = buildContractMock({
  baseUrl: resolveServiceURL('activity'),
  contract: activityContract,
  resolveContext: () => ({}),
});
