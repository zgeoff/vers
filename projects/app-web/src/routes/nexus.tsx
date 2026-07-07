import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { css } from '@vers/styled-system/css';
import { requireAuth } from '../lib/auth/require-auth';
import { NexusPanel } from './-nexus/nexus-panel';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());

export const Route = createFileRoute('/nexus')({
  component: NexusPage,
  head: () => ({ meta: [{ title: 'vers | Nexus' }] }),
  loader: () => requireAuthFn(),
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
