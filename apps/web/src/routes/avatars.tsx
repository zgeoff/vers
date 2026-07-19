import { createFileRoute } from '@tanstack/react-router';
import { readAvatars } from '../lib/avatar/read-avatars';
import { AvatarRoster } from './-avatars/avatar-roster';

export const Route = createFileRoute('/avatars')({
  component: AvatarsPage,
  head: () => ({ meta: [{ title: 'vers | Avatars' }] }),
  loader: async () => ({ avatars: await readAvatars() }),
});

function AvatarsPage() {
  const data = Route.useLoaderData();

  return <AvatarRoster avatars={data.avatars} />;
}
