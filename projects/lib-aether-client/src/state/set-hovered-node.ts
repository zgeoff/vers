import type { AetherNode } from '@vers/aether-core';
import { useHoveredNodeStore } from './use-hovered-node-store';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function setHoveredNode(node: AetherNode | null) {
  useHoveredNodeStore.setState({ node });
}
