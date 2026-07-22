import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { avatarContract } from '@vers/contract-avatar';
import type { ServiceLinkContext } from '../build-service-link';
import { buildServiceLink } from '../build-service-link';

export const avatarClient: ContractRouterClient<typeof avatarContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('avatar', avatarContract));
