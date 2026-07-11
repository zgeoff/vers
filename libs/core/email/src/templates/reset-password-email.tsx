import * as E from '@react-email/components';
import type { ReactElement } from 'react';

interface Props {
  resetURL: string;
}

export function ResetPasswordEmail(props: Readonly<Props>): ReactElement {
  return (
    <E.Container>
      <E.Heading as="h1">
        <E.Text>Forgot your password?</E.Text>
      </E.Heading>
      <E.Text>
        We received a request to reset your password. To reset your password, please click the link
        below:
      </E.Text>
      <E.Link href={props.resetURL}>{props.resetURL}</E.Link>
      <E.Text>If you did not request a password reset, please ignore this email.</E.Text>
    </E.Container>
  );
}
