import * as E from '@react-email/components';
import type { ReactElement } from 'react';

interface Props {
  newEmail: string;
  verificationCode: string;
  verificationURL: string;
}

export function ChangeEmailVerificationEmail(props: Props): ReactElement {
  return (
    <E.Container>
      <E.Heading as="h1">
        <E.Text>Verify your new email address</E.Text>
      </E.Heading>
      <E.Text>
        You&apos;ve requested to change your email address to <strong>{props.newEmail}</strong>.
        Please click the link below to complete the change.
      </E.Text>
      <E.Button href={props.verificationURL}>Verify email address</E.Button>
      <E.Text>
        Or enter the following verification code: <strong>{props.verificationCode}</strong>
      </E.Text>
      <E.Text>
        If you did not request this change, your account has been compromised. Please reset your
        password immediately <E.Link href="https://versidle.com/forgot-password">here</E.Link>.
      </E.Text>
    </E.Container>
  );
}
