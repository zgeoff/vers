import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { sessionContract } from '@vers/contract-session';
import type { ServiceLinkContext } from '../build-service-link';
import { buildServiceLink } from '../build-service-link';

export const sessionClient: ContractRouterClient<typeof sessionContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('session'));
