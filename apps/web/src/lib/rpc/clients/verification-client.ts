import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { verificationContract } from '@vers/contract-verification';
import type { ServiceLinkContext } from '../build-service-link';
import { buildServiceLink } from '../build-service-link';

export const verificationClient: ContractRouterClient<
  typeof verificationContract,
  ServiceLinkContext
> = createORPCClient(buildServiceLink('verification'));
