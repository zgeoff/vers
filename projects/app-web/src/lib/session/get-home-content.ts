import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { pickSessionHeaders } from '../rpc/pick-session-headers';
import { pickHomeContent } from './pick-home-content';
import { readCurrentUserResult } from './read-current-user-result';

/**
 * GET server function: fetches the acting session server-side and renders the matching
 * index-route content. Untestable end to end under `bun test`: `getRequestHeaders` throws outside
 * the live server runtime's `AsyncLocalStorage` context, since `bun test` resolves package exports
 * without the `react-server` condition. Auth-state branch selection is extracted into a pure unit
 * with its own direct tests.
 */
export const getHomeContent = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await readCurrentUserResult(pickSessionHeaders(getRequestHeaders()));
  const Renderable = await renderServerComponent(pickHomeContent(result));

  return { Renderable };
});
