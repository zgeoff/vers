import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { createIsomorphicFn } from '@tanstack/react-start';
import { avatarContract } from '@vers/contract-avatar';
import { buildProxyServiceLink } from '../build-proxy-service-link';
import { buildServiceLink } from '../build-service-link';
import type { ServiceLinkContext } from '../types';

export const avatarClient: ContractRouterClient<typeof avatarContract, ServiceLinkContext> =
  createORPCClient(
    createIsomorphicFn()
      .server(() => buildServiceLink('avatar', avatarContract))
      .client(() => buildProxyServiceLink('avatar'))(),
  );
