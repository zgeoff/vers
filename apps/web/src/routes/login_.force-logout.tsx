import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { ForceLogoutForm } from './-login-force-logout/force-logout-form';
import { requireForceLogoutPending } from './-login-force-logout/require-force-logout-pending';

const forceLogoutLoaderFn = createServerFn({ method: 'GET' }).handler(() =>
  requireForceLogoutPending(),
);

export const Route = createFileRoute('/login_/force-logout')({
  component: ForceLogoutPage,
  head: () => ({ meta: [{ title: 'vers | Login' }] }),
  loader: () => forceLogoutLoaderFn(),
});

function ForceLogoutPage() {
  return (
    <AuthLayout>
      <ForceLogoutForm />
    </AuthLayout>
  );
}
