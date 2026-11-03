import { buildContractMock } from '@vers/client-test-utils/orpc';
import { avatarContract } from '@vers/contract-avatar';
import { resolveServiceURL } from '../resolve-service-url';

export const mockAvatarService = buildContractMock({
  baseUrl: resolveServiceURL('avatar'),
  contract: avatarContract,
  resolveContext: () => ({}),
});
