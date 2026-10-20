import * as ReactEmail from '@react-email/components';
import type { ReactElement } from 'react';

interface Props {
  verificationCode: string;
}

export function TwoFactorEmail(props: Readonly<Props>): ReactElement {
  return (
    <ReactEmail.Container>
      <ReactEmail.Heading as="h1">
        <ReactEmail.Text>Your two-factor sign-in code</ReactEmail.Text>
      </ReactEmail.Heading>
      <ReactEmail.Text>
        Enter the following code to finish signing in to your vers account:{' '}
        <strong>{props.verificationCode}</strong>
      </ReactEmail.Text>
      <ReactEmail.Text>
        If you did not attempt to sign in, someone else may know your password. Please reset it
        immediately{' '}
        <ReactEmail.Link href="https://versidle.com/forgot-password">here</ReactEmail.Link>.
      </ReactEmail.Text>
    </ReactEmail.Container>
  );
}
