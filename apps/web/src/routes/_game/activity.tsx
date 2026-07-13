import { createFileRoute } from '@tanstack/react-router';
import { ActivityPanel } from '../-activity/activity-panel';

export const Route = createFileRoute('/_game/activity')({
  component: ActivityPanel,
  head: () => ({ meta: [{ title: 'vers | Activity' }] }),
  staticData: { presentation: 'ambient' },
});
