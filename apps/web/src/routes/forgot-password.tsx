import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { requireAnonymous } from '../lib/auth/require-anonymous';
import { ForgotPasswordForm } from './-forgot-password/forgot-password-form';

const requireAnonymousFn = createServerFn({ method: 'GET' }).handler(() => requireAnonymous());

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordForm,
  head: () => ({ meta: [{ title: 'vers | Forgot Password' }] }),
  loader: () => requireAnonymousFn(),
});
