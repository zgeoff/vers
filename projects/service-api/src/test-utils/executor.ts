import { buildHTTPExecutor } from '@graphql-tools/executor-http';
import { createYoga } from 'graphql-yoga';
import { env } from '../env';
import { schema } from '../schema';

const yoga = createYoga({
  graphiql: env.isDevelopment,
  graphqlEndpoint: '/graphql',
  logging: env.LOGGING,
  maskedErrors: env.isProduction,
  schema,
});

export const executor = buildHTTPExecutor({
  fetch: yoga.fetch,
});
