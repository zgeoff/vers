import { createFileRoute } from '@tanstack/react-router';
import { ActivityPanel } from '../-activity/activity-panel';
import { requireActiveAvatarOrLastKnown } from '../../lib/avatar/require-active-avatar-or-last-known';

export const Route = createFileRoute('/_game/activity')({
  component: ActivityPanel,
  head: () => ({ meta: [{ title: 'vers | Activity' }] }),
  loader: (opts) => requireActiveAvatarOrLastKnown(opts.context.queryClient),
  staticData: { presentation: 'ambient' },
});
