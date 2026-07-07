import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { requireAuth } from '../lib/auth/require-auth';
import { AvatarCreateForm } from './-avatar-create/avatar-create-form';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());

export const Route = createFileRoute('/avatar_/create')({
  component: AvatarCreateForm,
  head: () => ({ meta: [{ title: 'vers | Create an Avatar' }] }),
  loader: () => requireAuthFn(),
});
