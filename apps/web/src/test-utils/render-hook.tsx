import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook as renderHookRTL } from '@testing-library/react';
import { buildQueryClient } from '../lib/query/build-query-client';

type RenderHookResult<Result> = ReturnType<typeof renderHookRTL<Result, undefined>> & {
  /**
   * The query client the hook mounted under, for driving cache invalidation from the test.
   */
  readonly queryClient: QueryClient;
};

/**
 * The project hook-render util: mounts the hook under the app's providers (a fresh
 * `buildQueryClient` per call) and returns RTL's handle with that query client beside it.
 */
export function renderHook<Result>(useHook: () => Result): RenderHookResult<Result> {
  const queryClient = buildQueryClient();

  const hook = renderHookRTL(useHook, {
    wrapper: (props: Readonly<{ children: React.ReactNode }>) => (
      <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
    ),
  });

  return Object.assign(hook, { queryClient });
}
