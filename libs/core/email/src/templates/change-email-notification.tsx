import * as ReactEmail from '@react-email/components';
import type { ReactElement } from 'react';

export function ChangeEmailNotificationEmail(): ReactElement {
  return (
    <ReactEmail.Container>
      <ReactEmail.Heading as="h1">
        <ReactEmail.Text>Your email address has been changed</ReactEmail.Text>
      </ReactEmail.Heading>
      <ReactEmail.Text>Your account&apos;s email address has been changed.</ReactEmail.Text>
      <ReactEmail.Hr />
      <ReactEmail.Text>
        If you did not make this change, please{' '}
        <ReactEmail.Link href="https://versidle.com/contact">contact support</ReactEmail.Link>
        immediately as your account may have been compromised.
      </ReactEmail.Text>
    </ReactEmail.Container>
  );
}
