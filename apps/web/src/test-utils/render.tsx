import type { QueryClient } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import { render as renderRTL } from '@testing-library/react';
import type { ReactElement } from 'react';
import { cloneElement } from 'react';
import { buildQueryClient } from '../lib/query/build-query-client';

type RenderResult = ReturnType<typeof renderRTL> & {
  readonly queryClient: QueryClient;
  readonly refresh: () => void;
};

export function render(ui: Readonly<ReactElement>): RenderResult {
  const queryClient = buildQueryClient();
  const rendered = renderRTL(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  const refresh = () => {
    rendered.rerender(
      <QueryClientProvider client={queryClient}>{cloneElement(ui)}</QueryClientProvider>,
    );
  };

  return Object.assign(rendered, { queryClient, refresh });
}
