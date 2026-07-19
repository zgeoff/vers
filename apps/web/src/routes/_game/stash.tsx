import { createFileRoute } from '@tanstack/react-router';
import { StashPanel } from '../-stash/stash-panel';
import { requireActiveAvatar } from '../../lib/avatar/require-active-avatar';

export const Route = createFileRoute('/_game/stash')({
  component: StashPanel,
  head: () => ({ meta: [{ title: 'vers | Stash' }] }),
  loader: () => requireActiveAvatar(),
  staticData: { presentation: 'ambient' },
});
