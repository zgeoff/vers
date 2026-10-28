import { createFileRoute } from '@tanstack/react-router';
import { css } from '@vers/styled-system/css';
import { RespitePanel } from '../-respite/respite-panel';
import { requireActiveAvatarOrLastKnown } from '../../lib/avatar/require-active-avatar-or-last-known';

export const Route = createFileRoute('/_game/respite')({
  component: RespitePage,
  head: () => ({ meta: [{ title: 'vers | Respite' }] }),
  loader: (opts) => requireActiveAvatarOrLastKnown(opts.context.queryClient),
  staticData: { presentation: 'focus', scene: 'respite' },
});

function RespitePage() {
  const ctx = Route.useRouteContext();

  return (
    <main
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        padding: '6',
        textAlign: 'center',
      })}
    >
      <RespitePanel orpc={ctx.orpc} />
    </main>
  );
}
