import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { createIsomorphicFn } from '@tanstack/react-start';
import { activityContract } from '@vers/contract-activity';
import { buildProxyServiceLink } from '../build-proxy-service-link';
import { buildServiceLink } from '../build-service-link';
import type { ServiceLinkContext } from '../types';

export const activityClient: ContractRouterClient<typeof activityContract, ServiceLinkContext> =
  createORPCClient(
    createIsomorphicFn()
      .server(() => buildServiceLink('activity', activityContract))
      .client(() => buildProxyServiceLink('activity'))(),
  );
