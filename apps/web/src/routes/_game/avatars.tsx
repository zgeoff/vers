import { createFileRoute } from '@tanstack/react-router';
import { AvatarRoster } from '../-avatars/avatar-roster';
import { readAvatars } from '../../lib/avatar/read-avatars';
import { readWithLastKnown } from '../../lib/offline/read-with-last-known';

export const Route = createFileRoute('/_game/avatars')({
  component: AvatarsPage,
  head: () => ({ meta: [{ title: 'vers | Avatars' }] }),
  loader: async (opts) => ({
    roster: await readWithLastKnown(opts.context.queryClient, 'avatar-roster', () => readAvatars()),
  }),
  staticData: { presentation: 'ambient' },
});

function AvatarsPage() {
  const data = Route.useLoaderData();

  return <AvatarRoster roster={data.roster} />;
}
