import { createFileRoute } from '@tanstack/react-router';
import { AvatarPanel } from '../-avatar/avatar-panel';
import { getAvatarContent } from '../../lib/avatar/get-avatar-content';
import { requireActiveAvatarOrLastKnown } from '../../lib/avatar/require-active-avatar-or-last-known';

export const Route = createFileRoute('/_game/avatar')({
  component: AvatarPage,
  head: () => ({ meta: [{ title: 'vers | Avatar' }] }),
  loader: async (opts) => {
    await requireActiveAvatarOrLastKnown(opts.context.queryClient);

    const avatarContent = await getAvatarContent();

    return { Content: avatarContent.Renderable };
  },
  staticData: { presentation: 'ambient' },
});

function AvatarPage() {
  const data = Route.useLoaderData();
  const routeContext = Route.useRouteContext();

  return <AvatarPanel Content={data.Content} placeholder={!routeContext.flags['game-renderer']} />;
}
