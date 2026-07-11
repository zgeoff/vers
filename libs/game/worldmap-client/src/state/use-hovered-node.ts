import { useShallow } from 'zustand/react/shallow';
import { useHoveredNodeStore } from './use-hovered-node-store';

export function useHoveredNode() {
  const node = useHoveredNodeStore(useShallow((state) => state.node));

  return node;
}
