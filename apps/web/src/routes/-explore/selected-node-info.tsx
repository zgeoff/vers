import { Link } from '@tanstack/react-router';
import { Text } from '@vers/design-system';
import { useSelectedNode } from '@vers/worldmap-client';

export function SelectedNodeInfo() {
  const node = useSelectedNode().node;

  if (node === null) {
    return null;
  }

  return (
    <div>
      <Text data-testid="selected-node-id">World Node ({node.id})</Text>
      <Text data-testid="selected-node-difficulty">Difficulty {node.difficulty}</Text>
      <Link to="/explore/current">Click to start</Link>
    </div>
  );
}
