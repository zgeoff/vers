import { Link } from '@tanstack/react-router';
import { css } from '@vers/styled-system/css';
import type { ReactNode } from 'react';
import { DisableTwoFactorAuthForm } from './disable-two-factor-auth-form';
import { SignOutForm } from './sign-out-form';

interface AccountScreenProps {
  readonly Content: ReactNode;
  readonly has2FA: boolean;
}

const body = css({ display: 'flex', flexDirection: 'column', gap: '4' });
const actions = css({ display: 'flex', flexDirection: 'column', gap: '2', marginTop: '4' });

export function AccountScreen(props: Readonly<AccountScreenProps>) {
  return (
    <div className={body}>
      {props.Content}
      <section className={actions}>
        <Link to="/account/change-email">Change email</Link>
        <Link to="/account/change-password">Change password</Link>
        {props.has2FA ? (
          <DisableTwoFactorAuthForm />
        ) : (
          <Link to="/account/2fa/verify">Enable 2FA</Link>
        )}
        <SignOutForm />
      </section>
    </div>
  );
}
