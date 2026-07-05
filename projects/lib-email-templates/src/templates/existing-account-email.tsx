import * as E from '@react-email/components';
import type { ReactElement } from 'react';

interface Props {
  email: string;
}

export function ExistingAccountEmail(props: Props): ReactElement {
  return (
    <E.Container>
      <E.Heading as="h1">
        <E.Text>You already have an account</E.Text>
      </E.Heading>
      <E.Text>
        We noticed you tried to sign up with {props.email}, but you already have an account with us.
      </E.Text>
      <E.Text>
        If you&apos;ve forgotten your password, you can reset it using our password reset form.
      </E.Text>
      <E.Link href="https://versidle.com/forgot-password">Reset Password</E.Link>
    </E.Container>
  );
}
