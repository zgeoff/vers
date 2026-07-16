import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { activityContract } from '@vers/contract-activity';
import type { ServiceLinkContext } from '../build-service-link';
import { buildServiceLink } from '../build-service-link';

export const activityClient: ContractRouterClient<typeof activityContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('activity'));
