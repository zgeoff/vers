import { createFileRoute } from '@tanstack/react-router';
import { AvatarCreateForm } from '../-avatar-create/avatar-create-form';

export const Route = createFileRoute('/_game/avatars_/create')({
  component: AvatarCreateForm,
  head: () => ({ meta: [{ title: 'vers | Create an Avatar' }] }),
  staticData: { presentation: 'ambient' },
});
