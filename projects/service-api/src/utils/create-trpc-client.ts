import type { TRPCClient } from '@trpc/client';
import * as trpc from '@trpc/client';
import type { AnyTRPCRouter } from '@trpc/server';
import type { ServiceID } from '@vers/service-types';
import superjson from 'superjson';
import { env } from '../env';
import { logger } from '../logger';

export interface CreateTRPCClientConfig {
  accessToken?: null | string;
  apiURL: string;
  requestID: string;
  serviceID: ServiceID;
}

export function createTRPCClient<Router extends AnyTRPCRouter>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  config: CreateTRPCClientConfig,
): TRPCClient<Router> {
  const httpLink = trpc.httpLink({
    headers: {
      'x-request-id': config.requestID,
    },
    transformer: superjson,
    url: `${config.apiURL}trpc`,
  });

  const client = trpc.createTRPCClient<Router>({
    links: [
      httpLink,
      trpc.loggerLink({
        console: {
          error: logger.error,
          log: logger.info,
        },
        enabled: () => !env.isTest,
      }),
    ],
  });

  return client;
}
