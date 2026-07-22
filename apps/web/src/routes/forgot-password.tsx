import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { getHoneypotValidFrom } from '../lib/auth/get-honeypot-valid-from';
import { requireAnonymous } from '../lib/auth/require-anonymous';
import { ForgotPasswordForm } from './-forgot-password/forgot-password-form';

const requireAnonymousFn = createServerFn({ method: 'GET' }).handler(() => requireAnonymous());

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: 'vers | Forgot Password' }] }),
  loader: async () => {
    await requireAnonymousFn();

    return { honeypotValidFrom: await getHoneypotValidFrom() };
  },
});

function ForgotPasswordPage() {
  const loaderData = Route.useLoaderData();

  return (
    <AuthLayout>
      <ForgotPasswordForm honeypotValidFrom={loaderData.honeypotValidFrom} />
    </AuthLayout>
  );
}
