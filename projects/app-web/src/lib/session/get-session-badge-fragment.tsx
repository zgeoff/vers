import { createServerFn } from '@tanstack/react-start';
import { createCompositeComponent } from '@tanstack/react-start/rsc';
import { getRequestHeaders } from '@tanstack/react-start/server';
import type { ReactNode } from 'react';
import { toSessionHeaders } from '../rpc/to-session-headers';
import { pickSessionBadgeMessage } from './pick-session-badge-message';
import { tryReadCurrentUser } from './try-read-current-user';

/** The session-badge fragment's one client slot: a free-form refresh control. */
interface SessionBadgeFragmentProps {
  readonly children?: ReactNode;
}

/**
 * Renders the session-badge fragment server-side and hands back a Composite Component source: a
 * server-rendered summary of the acting session with a client-fillable slot for the refresh
 * control. Query owns this fragment's cache, independent of the index route's own server-rendered
 * content. Untestable end to end under `bun test`:
 * `getRequestHeaders` throws outside the live server runtime's `AsyncLocalStorage` context, and
 * `createCompositeComponent` resolves to a client-build stub that unconditionally throws, since
 * `bun test` resolves package exports without the `react-server` condition. Message selection is
 * extracted into a pure unit with its own direct tests.
 */
export const getSessionBadgeFragment = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await tryReadCurrentUser(toSessionHeaders(getRequestHeaders()));
  const message = pickSessionBadgeMessage(result);

  const src = await createCompositeComponent((props: SessionBadgeFragmentProps) => (
    <p data-testid="session-badge">
      {message}
      {props.children}
    </p>
  ));

  return { src };
});
