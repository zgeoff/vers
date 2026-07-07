import { createServerFn } from '@tanstack/react-start';
import { renderServerComponent } from '@tanstack/react-start/rsc';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { HomeContent } from '../../routes/-home/home-content';
import { toSessionHeaders } from '../rpc/to-session-headers';
import { tryReadCurrentUser } from './try-read-current-user';

/**
 * GET server function: reads the acting session server-side and renders the matching index-route
 * content. Untestable end to end under `bun test`: `getRequestHeaders` throws outside the live
 * server runtime's `AsyncLocalStorage` context, since `bun test` resolves package exports without
 * the `react-server` condition.
 */
export const getHomeContent = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await tryReadCurrentUser(toSessionHeaders(getRequestHeaders()));
  const Renderable = await renderServerComponent(<HomeContent result={result} />);

  return { Renderable };
});
