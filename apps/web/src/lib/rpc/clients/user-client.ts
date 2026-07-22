import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { createIsomorphicFn } from '@tanstack/react-start';
import { userContract } from '@vers/contract-user';
import { buildProxyServiceLink } from '../build-proxy-service-link';
import { buildServiceLink } from '../build-service-link';
import type { ServiceLinkContext } from '../types';

export const userClient: ContractRouterClient<typeof userContract, ServiceLinkContext> =
  createORPCClient(
    createIsomorphicFn()
      .server(() => buildServiceLink('user', userContract))
      .client(() => buildProxyServiceLink('user'))(),
  );
