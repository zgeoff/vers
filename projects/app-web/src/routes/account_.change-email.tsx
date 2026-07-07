import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '../lib/auth/require-auth';
import { ChangeEmailForm } from './-account-change-email/change-email-form';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());

export const Route = createFileRoute('/account_/change-email')({
  component: ChangeEmailForm,
  head: () => ({ meta: [{ title: 'vers | Change Email' }] }),
  loader: () => requireAuthFn(),
});
