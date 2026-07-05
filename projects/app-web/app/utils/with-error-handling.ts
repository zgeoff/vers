import type { AppLoadContext } from 'react-router';
import { handle401Error } from './handle-401-error';

interface DataFnArgs {
  context: AppLoadContext;
  params: Record<string, string | undefined>;
  request: Request;
}

/**
 * Thin wrapper for our loader & action functions where we can do generic
 * error handling.
 *
 * TODO(#61): reimplement as react-router middleware when it's officially released.
 *
 * @param dataFn - The loader or action function to wrap.
 */
export function withErrorHandling<Args extends DataFnArgs, Data>(
  dataFn: (args: Args) => Data | Promise<Data>,
) {
  return async (args: Args): Promise<Data> => {
    try {
      return await dataFn(args);
    } catch (error: unknown) {
      await handle401Error(args.request, error);

      throw error;
    }
  };
}
