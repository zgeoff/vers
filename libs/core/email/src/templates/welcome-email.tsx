import * as ReactEmail from '@react-email/components';

interface Props {
  verificationCode: string;
  verificationURL: string;
}

export function WelcomeEmail(props: Readonly<Props>) {
  return (
    <ReactEmail.Container>
      <ReactEmail.Heading as="h1">
        <ReactEmail.Text>Welcome to vers</ReactEmail.Text>
      </ReactEmail.Heading>
      <ReactEmail.Text>
        Please verify your vers account to get started. Just click on the link to get started:
      </ReactEmail.Text>
      <ReactEmail.Link href={props.verificationURL}>Verify your account</ReactEmail.Link>
      <ReactEmail.Text>Or enter the following verification code:</ReactEmail.Text>
      <strong>{props.verificationCode}</strong>
    </ReactEmail.Container>
  );
}
