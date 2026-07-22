import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { createIsomorphicFn } from '@tanstack/react-start';
import { sessionContract } from '@vers/contract-session';
import { buildProxyServiceLink } from '../build-proxy-service-link';
import { buildServiceLink } from '../build-service-link';
import type { ServiceLinkContext } from '../types';

export const sessionClient: ContractRouterClient<typeof sessionContract, ServiceLinkContext> =
  createORPCClient(
    createIsomorphicFn()
      .server(() => buildServiceLink('session', sessionContract))
      .client(() => buildProxyServiceLink('session'))(),
  );
