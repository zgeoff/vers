import { DevTools, NodeTooltip } from '@vers/worldmap-client';
import { SelectedNodeInfo } from './selected-node-info';

export function ExplorePanel() {
  return (
    <>
      <NodeTooltip />
      <SelectedNodeInfo />
      {import.meta.env.DEV && <DevTools />}
    </>
  );
}
