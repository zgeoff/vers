import { createFileRoute } from '@tanstack/react-router';
import { ActivityPanel } from '../-activity/activity-panel';
import { requireActiveAvatar } from '../../lib/avatar/require-active-avatar';

export const Route = createFileRoute('/_game/activity')({
  component: ActivityPanel,
  head: () => ({ meta: [{ title: 'vers | Activity' }] }),
  loader: () => requireActiveAvatar(),
  staticData: { presentation: 'ambient' },
});
