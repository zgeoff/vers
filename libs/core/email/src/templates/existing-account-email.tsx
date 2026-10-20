import * as ReactEmail from '@react-email/components';
import type { ReactElement } from 'react';

interface Props {
  email: string;
}

export function ExistingAccountEmail(props: Readonly<Props>): ReactElement {
  return (
    <ReactEmail.Container>
      <ReactEmail.Heading as="h1">
        <ReactEmail.Text>You already have an account</ReactEmail.Text>
      </ReactEmail.Heading>
      <ReactEmail.Text>
        We noticed you tried to sign up with {props.email}, but you already have an account with us.
      </ReactEmail.Text>
      <ReactEmail.Text>
        If you&apos;ve forgotten your password, you can reset it using our password reset form.
      </ReactEmail.Text>
      <ReactEmail.Link href="https://versidle.com/forgot-password">Reset Password</ReactEmail.Link>
    </ReactEmail.Container>
  );
}
