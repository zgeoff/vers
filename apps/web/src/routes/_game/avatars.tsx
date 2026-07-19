import { createFileRoute } from '@tanstack/react-router';
import { AvatarRoster } from '../-avatars/avatar-roster';
import { readAvatars } from '../../lib/avatar/read-avatars';

export const Route = createFileRoute('/_game/avatars')({
  component: AvatarsPage,
  head: () => ({ meta: [{ title: 'vers | Avatars' }] }),
  loader: async () => ({ avatars: await readAvatars() }),
  staticData: { presentation: 'ambient' },
});

function AvatarsPage() {
  const data = Route.useLoaderData();

  return <AvatarRoster avatars={data.avatars} />;
}
