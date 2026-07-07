import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { avatarContract } from '@vers/contract-avatar';
import type { sessionContract } from '@vers/contract-session';
import type { userContract } from '@vers/contract-user';
import type { verificationContract } from '@vers/contract-verification';
import type { ServiceLinkContext } from './build-service-link';
import { buildServiceLink } from './build-service-link';

/** Contract-typed oRPC client for the user service: direct-to-service on SSR, proxied in the browser. */
export const userClient: ContractRouterClient<typeof userContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('user'));

/** Contract-typed oRPC client for the session service: direct-to-service on SSR, proxied in the browser. */
export const sessionClient: ContractRouterClient<typeof sessionContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('session'));

/** Contract-typed oRPC client for the verification service: direct-to-service on SSR, proxied in the browser. */
export const verificationClient: ContractRouterClient<
  typeof verificationContract,
  ServiceLinkContext
> = createORPCClient(buildServiceLink('verification'));

/** Contract-typed oRPC client for the avatar service: direct-to-service on SSR, proxied in the browser. */
export const avatarClient: ContractRouterClient<typeof avatarContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('avatar'));
