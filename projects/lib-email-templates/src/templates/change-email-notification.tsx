import * as E from '@react-email/components';
import type { ReactElement } from 'react';

export function ChangeEmailNotificationEmail(): ReactElement {
  return (
    <E.Container>
      <E.Heading as="h1">
        <E.Text>Your email address has been changed</E.Text>
      </E.Heading>
      <E.Text>Your account&apos;s email address has been changed.</E.Text>
      <E.Hr />
      <E.Text>
        If you did not make this change, please{' '}
        <E.Link href="https://versidle.com/contact">contact support</E.Link>
        immediately as your account may have been compromised.
      </E.Text>
    </E.Container>
  );
}
