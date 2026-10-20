import * as ReactEmail from '@react-email/components';
import type { ReactElement } from 'react';

interface Props {
  resetURL: string;
}

export function ResetPasswordEmail(props: Readonly<Props>): ReactElement {
  return (
    <ReactEmail.Container>
      <ReactEmail.Heading as="h1">
        <ReactEmail.Text>Forgot your password?</ReactEmail.Text>
      </ReactEmail.Heading>
      <ReactEmail.Text>
        We received a request to reset your password. To reset your password, please click the link
        below:
      </ReactEmail.Text>
      <ReactEmail.Link href={props.resetURL}>{props.resetURL}</ReactEmail.Link>
      <ReactEmail.Text>
        If you did not request a password reset, please ignore this email.
      </ReactEmail.Text>
    </ReactEmail.Container>
  );
}
