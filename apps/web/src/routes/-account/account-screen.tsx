import { Link } from '@tanstack/react-router';
import { Button } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import type { ReactNode } from 'react';
import { DisableTwoFactorAuthForm } from './disable-two-factor-auth-form';

interface AccountScreenProps {
  readonly Content: ReactNode;
  readonly has2FA: boolean;
}

const screen = css({ display: 'flex', flexDirection: 'column', gap: '4', padding: '6' });
const actions = css({ display: 'flex', flexDirection: 'column', gap: '2', marginTop: '4' });

/**
 * The account settings view, shared by the standalone `/account` route and the in-shell settings
 * sheet. Sub-flows still link out to their own top-level routes.
 */
export function AccountScreen(props: Readonly<AccountScreenProps>) {
  return (
    <main className={screen}>
      {props.Content}
      <section className={actions}>
        <Link to="/account/change-email">Change email</Link>
        <Link to="/account/change-password">Change password</Link>
        {props.has2FA ? (
          <DisableTwoFactorAuthForm />
        ) : (
          <Link to="/account/2fa/verify">Enable 2FA</Link>
        )}
        <form action="/logout" method="post">
          <Button type="submit" variant="link">
            Logout
          </Button>
        </form>
      </section>
    </main>
  );
}
