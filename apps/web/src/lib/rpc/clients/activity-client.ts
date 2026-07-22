import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { activityContract } from '@vers/contract-activity';
import type { ServiceLinkContext } from '../build-service-link';
import { buildServiceLink } from '../build-service-link';

export const activityClient: ContractRouterClient<typeof activityContract, ServiceLinkContext> =
  createORPCClient(buildServiceLink('activity', activityContract));
