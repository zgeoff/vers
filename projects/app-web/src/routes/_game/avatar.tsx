import { createFileRoute } from '@tanstack/react-router';
import { css } from '@vers/styled-system/css';
import { getAvatarContent } from '../../lib/avatar/get-avatar-content';

export const Route = createFileRoute('/_game/avatar')({
  component: AvatarPage,
  head: () => ({ meta: [{ title: 'vers | Avatar' }] }),
  loader: async () => {
    const avatarContent = await getAvatarContent();

    return { Content: avatarContent.Renderable };
  },
});

function AvatarPage() {
  const data = Route.useLoaderData();

  return (
    <main className={css({ display: 'flex', flexDirection: 'column', gap: '4', padding: '6' })}>
      {data.Content}
    </main>
  );
}
