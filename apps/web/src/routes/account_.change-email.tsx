import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { requireAuth } from '../lib/auth/require-auth';
import { ChangeEmailForm } from './-account-change-email/change-email-form';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());

export const Route = createFileRoute('/account_/change-email')({
  component: ChangeEmailPage,
  head: () => ({ meta: [{ title: 'vers | Change Email' }] }),
  loader: () => requireAuthFn(),
});

function ChangeEmailPage() {
  return (
    <AuthLayout>
      <ChangeEmailForm />
    </AuthLayout>
  );
}
