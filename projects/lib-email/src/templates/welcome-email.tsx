import * as E from '@react-email/components';

interface Props {
  verificationCode: string;
  verificationURL: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function WelcomeEmail(props: Props) {
  return (
    <E.Container>
      <E.Heading as="h1">
        <E.Text>Welcome to vers</E.Text>
      </E.Heading>
      <E.Text>
        Please verify your vers account to get started. Just click on the link to get started:
      </E.Text>
      <E.Link href={props.verificationURL}>Verify your account</E.Link>
      <E.Text>Or enter the following verification code:</E.Text>
      <strong>{props.verificationCode}</strong>
    </E.Container>
  );
}
