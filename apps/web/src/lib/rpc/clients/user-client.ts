import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { userContract } from '@vers/contract-user';
import type { ServiceLinkContext } from '../build-service-link';
import { buildServiceLink } from '../build-service-link';

export const userClient: ContractRouterClient<typeof userContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('user'));
