import * as E from '@react-email/components';

interface Props {
  email: string;
}

export function PasswordChangedEmail(props: Props) {
  return (
    <E.Container>
      <E.Heading as="h1">
        <E.Text>Your password has been changed</E.Text>
      </E.Heading>
      <E.Text>
        The password for your account ({props.email}) was just changed. If you made this change, you
        can safely ignore this email.
      </E.Text>
      <E.Text>
        If you did not change your password, your account has been compromised. Please reset your
        password immediately <E.Link href="https://versidle.com/forgot-password">here</E.Link>.
      </E.Text>
    </E.Container>
  );
}
