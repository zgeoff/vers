import { Heading, Text } from '@vers/design-system';
import type { ReactElement } from 'react';
import type { CurrentUserResult } from './read-current-user-result';

/**
 * Selects the index route's anon vs signed-in server-rendered content for a resolved session
 * result. Split out from the route's server function so the auth-state branch is reachable by a
 * plain render, independent of `getRequestHeaders`/`renderServerComponent` — both require the live
 * TanStack Start server runtime and can't run under `bun test`.
 */
export function pickHomeContent(result: CurrentUserResult): ReactElement {
  return result.authenticated ? <SignedInHome name={result.user.name} /> : <AnonHome />;
}

function AnonHome(): ReactElement {
  return (
    <section>
      <Heading level={1}>vers</Heading>
      <Text data-testid="home-anon">You are not signed in.</Text>
    </section>
  );
}

function SignedInHome(props: Readonly<{ name: string }>): ReactElement {
  return (
    <section>
      <Heading level={1}>vers</Heading>
      <Text data-testid="home-signed-in">Welcome back, {props.name}.</Text>
    </section>
  );
}
