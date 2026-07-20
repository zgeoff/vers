import { createFileRoute } from '@tanstack/react-router';
import { ActivityPanel } from '../-activity/activity-panel';
import { requireActiveActivity } from '../../lib/activity/require-active-activity';

export const Route = createFileRoute('/_game/activity')({
  component: ActivityPanel,
  head: () => ({ meta: [{ title: 'vers | Activity' }] }),
  loader: () => requireActiveActivity(),
  staticData: { presentation: 'ambient' },
});
