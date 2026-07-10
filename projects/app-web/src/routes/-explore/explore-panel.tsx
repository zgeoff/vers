import { DevTools, NodeTooltip } from '@vers/aether-client';
import { SelectedNodeInfo } from './selected-node-info';

/**
 * The explore route's DOM-lane chrome: the world itself renders through the game layout's
 * persistent canvas, so this component owns only the tooltip, selection panel, and dev tools.
 */
export function ExplorePanel() {
  return (
    <>
      <NodeTooltip />
      <SelectedNodeInfo />
      {import.meta.env.DEV && <DevTools />}
    </>
  );
}
