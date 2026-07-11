import { Heading, Text } from '@vers/design-system';
import type { ReactElement } from 'react';
import type { CurrentUserResult } from '../../lib/session/try-read-current-user';

export function HomeContent(props: Readonly<{ result: CurrentUserResult }>): ReactElement {
  return props.result.authenticated ? <SignedInHome name={props.result.user.name} /> : <AnonHome />;
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
