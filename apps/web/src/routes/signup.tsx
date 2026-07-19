import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { requireAnonymous } from '../lib/auth/require-anonymous';
import { SignupForm } from './-signup/signup-form';

const requireAnonymousFn = createServerFn({ method: 'GET' }).handler(() => requireAnonymous());

export const Route = createFileRoute('/signup')({
  component: SignupPage,
  head: () => ({ meta: [{ title: 'vers | Signup' }] }),
  loader: () => requireAnonymousFn(),
});

function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}
