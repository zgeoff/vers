import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { emailContract } from '@vers/contract-email';
import type { ServiceLinkContext } from '../build-service-link';
import { buildServiceLink } from '../build-service-link';

export const emailClient: ContractRouterClient<typeof emailContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('email'));
