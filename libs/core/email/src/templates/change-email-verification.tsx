import * as ReactEmail from '@react-email/components';
import type { ReactElement } from 'react';

interface Props {
  newEmail: string;
  verificationCode: string;
  verificationURL: string;
}

export function ChangeEmailVerificationEmail(props: Readonly<Props>): ReactElement {
  return (
    <ReactEmail.Container>
      <ReactEmail.Heading as="h1">
        <ReactEmail.Text>Verify your new email address</ReactEmail.Text>
      </ReactEmail.Heading>
      <ReactEmail.Text>
        You&apos;ve requested to change your email address to <strong>{props.newEmail}</strong>.
        Please click the link below to complete the change.
      </ReactEmail.Text>
      <ReactEmail.Button href={props.verificationURL}>Verify email address</ReactEmail.Button>
      <ReactEmail.Text>
        Or enter the following verification code: <strong>{props.verificationCode}</strong>
      </ReactEmail.Text>
      <ReactEmail.Text>
        If you did not request this change, your account has been compromised. Please reset your
        password immediately{' '}
        <ReactEmail.Link href="https://versidle.com/forgot-password">here</ReactEmail.Link>.
      </ReactEmail.Text>
    </ReactEmail.Container>
  );
}
