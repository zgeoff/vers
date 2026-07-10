import { DevTools, NodeTooltip } from '@vers/aether-client';
import { SelectedNodeInfo } from './selected-node-info';

/**
 * The aether route's DOM-lane chrome: the world itself renders through the game layout's
 * persistent canvas, so this component owns only the tooltip, selection panel, and dev tools.
 */
export function AetherPanel() {
  return (
    <>
      <NodeTooltip />
      <SelectedNodeInfo />
      {import.meta.env.DEV && <DevTools />}
    </>
  );
}
