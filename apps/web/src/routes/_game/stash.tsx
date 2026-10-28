import { createFileRoute } from '@tanstack/react-router';
import { StashPanel } from '../-stash/stash-panel';
import { requireActiveAvatarOrLastKnown } from '../../lib/avatar/require-active-avatar-or-last-known';

export const Route = createFileRoute('/_game/stash')({
  component: StashPanel,
  head: () => ({ meta: [{ title: 'vers | Stash' }] }),
  loader: (opts) => requireActiveAvatarOrLastKnown(opts.context.queryClient),
  staticData: { presentation: 'ambient' },
});
