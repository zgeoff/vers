import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { setSelectedNode } from '@vers/aether-client';
import type { AetherNode } from '@vers/aether-core';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { ExplorePanel } from './explore-panel';

const node: AetherNode = {
  connections: ['conn1', null, 'conn2', null],
  difficulty: 2,
  id: 'node123',
  index: 3,
  position: [1.2345, 6.789],
  seed: 12_345,
};

test('it renders no canvas of its own', () => {
  setSelectedNode(null);

  const rendered = renderWithRouter(<ExplorePanel />);

  expect(rendered.container.querySelector('canvas')).not.toBeInTheDocument();
});

test('it shows the selected node once the graph reports one', async () => {
  setSelectedNode(node, null);

  renderWithRouter(<ExplorePanel />);

  const nodeID = await screen.findByTestId('selected-node-id');

  expect(nodeID).toHaveTextContent('Aether Node (node123)');
});
