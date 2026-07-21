import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { setSelectedNode } from '@vers/worldmap-client';
import { createMockWorldMapNode } from '@vers/worldmap-client/test-utils';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { SelectedNodeInfo } from './selected-node-info';

test('it renders nothing with no node selected', () => {
  setSelectedNode(null);
  renderWithRouter(<SelectedNodeInfo />);

  expect(screen.queryByTestId('selected-node-id')).not.toBeInTheDocument();
});

test('it shows the selected node and links into its activity', async () => {
  const node = createMockWorldMapNode({ difficulty: 2, id: 'node123' });

  setSelectedNode(node, null);
  renderWithRouter(<SelectedNodeInfo />);

  const nodeID = await screen.findByTestId('selected-node-id');

  expect(nodeID).toHaveTextContent('World Map Node (node123)');
  expect(screen.getByTestId('selected-node-difficulty')).toHaveTextContent('Difficulty 2');

  expect(screen.getByRole('link', { name: 'Click to start' })).toHaveAttribute(
    'href',
    '/explore/current',
  );
});
