import { Link } from '@tanstack/react-router';
import { useSelectedNode } from '@vers/aether-client';
import { Text } from '@vers/design-system';

/** The aether map's client-lane read: the currently selected node's summary and a way in. */
export function SelectedNodeInfo() {
  const node = useSelectedNode().node;

  if (node === null) {
    return null;
  }

  return (
    <div>
      <Text data-testid="selected-node-id">Aether Node ({node.id})</Text>
      <Text data-testid="selected-node-difficulty">Difficulty {node.difficulty}</Text>
      <Link to="/aether/current">Click to start</Link>
    </div>
  );
}
