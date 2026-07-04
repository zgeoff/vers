import type { ReactElement } from 'react';
import * as E from '@react-email/components';

interface Props {
  verificationCode: string;
}

export function TwoFactorEmail(props: Props): ReactElement {
  return (
    <E.Container>
      <E.Heading as="h1">
        <E.Text>Your two-factor sign-in code</E.Text>
      </E.Heading>
      <E.Text>
        Enter the following code to finish signing in to your vers account:{' '}
        <strong>{props.verificationCode}</strong>
      </E.Text>
      <E.Text>
        If you did not attempt to sign in, someone else may know your password.
        Please reset it immediately{' '}
        <E.Link href="https://versidle.com/forgot-password">here</E.Link>.
      </E.Text>
    </E.Container>
  );
}
