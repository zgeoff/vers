import { QueryClientProvider } from '@tanstack/react-query';
import { render as renderRTL } from '@testing-library/react';
import type { ReactElement } from 'react';
import { cloneElement } from 'react';
import { buildQueryClient } from '../lib/query/build-query-client';

type RenderResult = ReturnType<typeof renderRTL> & {
  /**
   * Re-renders the same tree in place — a fresh element over the same query client — so effects
   * re-run against updated ambient test state without remounting.
   */
  readonly refresh: () => void;
};

/**
 * The project render util for component tests: wraps the tree in the app's providers (a fresh
 * `buildQueryClient` per render) and returns RTL's queries bound to it. Trees that need
 * router-aware primitives render through `renderWithRouter` instead.
 */
export function render(ui: Readonly<ReactElement>): RenderResult {
  const queryClient = buildQueryClient();
  const rendered = renderRTL(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);

  const refresh = () => {
    rendered.rerender(
      <QueryClientProvider client={queryClient}>{cloneElement(ui)}</QueryClientProvider>,
    );
  };

  return Object.assign(rendered, { refresh });
}
