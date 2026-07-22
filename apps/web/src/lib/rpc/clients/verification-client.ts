import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { createIsomorphicFn } from '@tanstack/react-start';
import { verificationContract } from '@vers/contract-verification';
import { buildProxyServiceLink } from '../build-proxy-service-link';
import { buildServiceLink } from '../build-service-link';
import type { ServiceLinkContext } from '../types';

export const verificationClient: ContractRouterClient<
  typeof verificationContract,
  ServiceLinkContext
> = createORPCClient(
  createIsomorphicFn()
    .server(() => buildServiceLink('verification', verificationContract))
    .client(() => buildProxyServiceLink('verification'))(),
);
