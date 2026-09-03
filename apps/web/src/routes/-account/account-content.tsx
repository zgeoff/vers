import type { UserData } from '@vers/contract-user';
import { Heading, Text } from '@vers/design-system';
import type { ReactElement } from 'react';

interface AccountContentProps {
  readonly has2FA: boolean;
  readonly user: UserData;
}

export function AccountContent(props: AccountContentProps): ReactElement {
  return (
    <section>
      <Heading level={2}>Account</Heading>
      <Text data-testid="account-username">Username: {props.user.username}</Text>
      <Text data-testid="account-name">Name: {props.user.name}</Text>
      <Text data-testid="account-email">Email: {props.user.email}</Text>
      <Text data-testid="account-2fa-status">
        Two-factor authentication is {props.has2FA ? 'enabled' : 'not enabled'}.
      </Text>
    </section>
  );
}
