import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { makeNodeTextMatcher } from '@vers/client-test-utils';
import { setHoveredNode } from '../state/set-hovered-node';
import { createMockWorldMapNode } from '../test-utils/factories/create-mock-world-map-node';
import { NodeTooltip } from './node-tooltip';

test('it displays information about the hovered node', () => {
  const node = createMockWorldMapNode({
    difficulty: 2,
    id: 'node123',
    position: [1.2345, 6.789],
  });

  setHoveredNode(node);
  render(<NodeTooltip />);

  const nodeID = screen.getByText('Test World Map Node (node123)');
  const [difficulty] = screen.getAllByText(makeNodeTextMatcher('Difficulty 2'));

  expect(nodeID).toBeInTheDocument();
  expect(difficulty).toBeInTheDocument();
});
