import { createFileRoute } from '@tanstack/react-router';
import { StashPanel } from '../-stash/stash-panel';

export const Route = createFileRoute('/_game/stash')({
  component: StashPanel,
  head: () => ({ meta: [{ title: 'vers | Stash' }] }),
  staticData: { presentation: 'ambient' },
});
