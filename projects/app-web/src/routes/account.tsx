import { Link, createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Button } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { getAccountContent } from '../lib/account/get-account-content';
import { requireAuth } from '../lib/auth/require-auth';
import { DisableTwoFactorAuthForm } from './-account/disable-two-factor-auth-form';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());

export const Route = createFileRoute('/account')({
  component: AccountPage,
  head: () => ({ meta: [{ title: 'vers | Account' }] }),
  loader: async () => {
    await requireAuthFn();

    const accountContent = await getAccountContent();

    return { Content: accountContent.Renderable, has2FA: accountContent.has2FA };
  },
});

const actionsStyles = css({ display: 'flex', flexDirection: 'column', gap: '2', marginTop: '4' });

function AccountPage() {
  const data = Route.useLoaderData();

  return (
    <main className={css({ display: 'flex', flexDirection: 'column', gap: '4', padding: '6' })}>
      {data.Content}
      <section className={actionsStyles}>
        <Link to="/account/change-email">Change email</Link>
        <Link to="/account/change-password">Change password</Link>
        {data.has2FA ? (
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
