import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { createIsomorphicFn } from '@tanstack/react-start';
import { emailContract } from '@vers/contract-email';
import { buildProxyServiceLink } from '../build-proxy-service-link';
import { buildServiceLink } from '../build-service-link';
import type { ServiceLinkContext } from '../types';

export const emailClient: ContractRouterClient<typeof emailContract, ServiceLinkContext> =
  createORPCClient(
    createIsomorphicFn()
      .server(() => buildServiceLink('email', emailContract))
      .client(() => buildProxyServiceLink('email'))(),
  );
