import { createFileRoute } from '@tanstack/react-router';
import { ExploreNodeFocus } from '../-explore-node/explore-node-focus';

export const Route = createFileRoute('/_game/explore/node/$nodeID')({
  component: ExploreNodeRoute,
});

function ExploreNodeRoute() {
  const params = Route.useParams();

  return <ExploreNodeFocus nodeID={params.nodeID} />;
}
