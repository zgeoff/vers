import { createFileRoute } from '@tanstack/react-router';
import { css } from '@vers/styled-system/css';
import { NexusPanel } from '../-nexus/nexus-panel';

export const Route = createFileRoute('/_game/nexus')({
  component: NexusPage,
  head: () => ({ meta: [{ title: 'vers | Nexus' }] }),
});

function NexusPage() {
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
      <NexusPanel orpc={ctx.orpc} />
    </main>
  );
}
