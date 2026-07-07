import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { avatarContract } from '@vers/contract-avatar';
import type { sessionContract } from '@vers/contract-session';
import type { userContract } from '@vers/contract-user';
import type { verificationContract } from '@vers/contract-verification';
import type { ServiceLinkContext } from './build-service-link';
import { buildServiceLink } from './build-service-link';

export const userClient: ContractRouterClient<typeof userContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('user'));

export const sessionClient: ContractRouterClient<typeof sessionContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('session'));

export const verificationClient: ContractRouterClient<
  typeof verificationContract,
  ServiceLinkContext
> = createORPCClient(buildServiceLink('verification'));

export const avatarClient: ContractRouterClient<typeof avatarContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('avatar'));
