import * as E from '@react-email/components';
import type { ReactElement } from 'react';

interface Props {
  resetURL: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function ResetPasswordEmail(props: Props): ReactElement {
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
