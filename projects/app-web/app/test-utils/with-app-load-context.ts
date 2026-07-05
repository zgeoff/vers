import type { AppLoadContext } from 'react-router';
import { createGQLClient } from '../utils/create-gql-client.server';

interface DataFnArgs {
  context: AppLoadContext;
  params: Record<string, string | undefined>;
  request: Request;
}

/**
 * Wraps a data function with a mock AppLoadContext as `createRoutesStub`
 * is set up for new experimental React Router context, not the old AppLoadContext.
 *
 * we can replace this when we migrate (#61)
 */
export function withAppLoadContext<Args extends DataFnArgs, Data>(
  dataFn: (args: Args) => Promise<Data>,
) {
  return async (args: Args) => {
    const context = {
      client: await createGQLClient(args.request),
    };

    return dataFn({ ...args, context });
  };
}
