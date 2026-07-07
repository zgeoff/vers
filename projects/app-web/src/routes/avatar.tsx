import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { css } from '@vers/styled-system/css';
import { requireAuth } from '../lib/auth/require-auth';
import { getAvatarContent } from '../lib/avatar/get-avatar-content';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());

export const Route = createFileRoute('/avatar')({
  component: AvatarPage,
  head: () => ({ meta: [{ title: 'vers | Avatar' }] }),
  loader: async () => {
    await requireAuthFn();

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
