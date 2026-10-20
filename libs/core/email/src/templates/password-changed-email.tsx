import * as ReactEmail from '@react-email/components';

interface Props {
  email: string;
}

export function PasswordChangedEmail(props: Readonly<Props>) {
  return (
    <ReactEmail.Container>
      <ReactEmail.Heading as="h1">
        <ReactEmail.Text>Your password has been changed</ReactEmail.Text>
      </ReactEmail.Heading>
      <ReactEmail.Text>
        The password for your account ({props.email}) was just changed. If you made this change, you
        can safely ignore this email.
      </ReactEmail.Text>
      <ReactEmail.Text>
        If you did not change your password, your account has been compromised. Please reset your
        password immediately{' '}
        <ReactEmail.Link href="https://versidle.com/forgot-password">here</ReactEmail.Link>.
      </ReactEmail.Text>
    </ReactEmail.Container>
  );
}
