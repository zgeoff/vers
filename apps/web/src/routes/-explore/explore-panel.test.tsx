import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { setSelectedNode } from '@vers/worldmap-client';
import { createMockWorldMapNode } from '@vers/worldmap-client/test-utils';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { ExplorePanel } from './explore-panel';

test('it renders no canvas of its own', () => {
  setSelectedNode(null);

  const rendered = renderWithRouter(<ExplorePanel />);

  expect(rendered.container.querySelector('canvas')).not.toBeInTheDocument();
});

test('it shows the selected node once the graph reports one', async () => {
  const node = createMockWorldMapNode({ id: 'node123' });

  setSelectedNode(node, null);
  renderWithRouter(<ExplorePanel />);

  const nodeID = await screen.findByTestId('selected-node-id');

  expect(nodeID).toHaveTextContent('World Map Node (node123)');
});
