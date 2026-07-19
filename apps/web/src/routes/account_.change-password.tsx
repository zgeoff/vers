import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { requireAuth } from '../lib/auth/require-auth';
import { ChangePasswordForm } from './-account-change-password/change-password-form';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());

export const Route = createFileRoute('/account_/change-password')({
  component: ChangePasswordPage,
  head: () => ({ meta: [{ title: 'vers | Change Password' }] }),
  loader: () => requireAuthFn(),
});

function ChangePasswordPage() {
  return (
    <AuthLayout>
      <ChangePasswordForm />
    </AuthLayout>
  );
}
