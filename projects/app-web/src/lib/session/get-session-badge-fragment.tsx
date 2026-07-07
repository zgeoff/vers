import { createServerFn } from '@tanstack/react-start';
import { createCompositeComponent } from '@tanstack/react-start/rsc';
import { getRequestHeaders } from '@tanstack/react-start/server';
import type { ReactNode } from 'react';
import { pickSessionHeaders } from '../rpc/pick-session-headers';
import { readCurrentUserResult } from './read-current-user-result';

/** The session-badge fragment's one client slot: a free-form refresh control. */
interface SessionBadgeFragmentProps {
  readonly children?: ReactNode;
}

/**
 * Renders the session-badge fragment server-side and hands back a Composite Component source: a
 * server-rendered summary of the acting session with a client-fillable slot for the refresh
 * control. Query owns this fragment's cache (see `session-badge-query.ts`), independent of the
 * index route's own server-rendered content.
 */
export const getSessionBadgeFragment = createServerFn({ method: 'GET' }).handler(async () => {
  const result = await readCurrentUserResult(pickSessionHeaders(getRequestHeaders()));
  const name = result.authenticated ? result.user.name : null;

  const message =
    name === null
      ? 'Flight fragment: no active session.'
      : `Flight fragment: signed in as ${name}.`;

  const src = await createCompositeComponent((props: SessionBadgeFragmentProps) => (
    <p data-testid="session-badge">
      {message}
      {props.children}
    </p>
  ));

  return { src };
});
