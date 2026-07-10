import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { setSelectedNode } from '@vers/aether-client';
import type { AetherNode } from '@vers/aether-core';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { SelectedNodeInfo } from './selected-node-info';

const node: AetherNode = {
  connections: ['conn1', null, 'conn2', null],
  difficulty: 2,
  id: 'node123',
  index: 3,
  position: [1.2345, 6.789],
  seed: 12_345,
};

test('it renders nothing with no node selected', () => {
  setSelectedNode(null);

  renderWithRouter(<SelectedNodeInfo />);

  expect(screen.queryByTestId('selected-node-id')).not.toBeInTheDocument();
});

test('it shows the selected node and links into its activity', async () => {
  setSelectedNode(node, null);

  renderWithRouter(<SelectedNodeInfo />);

  const nodeID = await screen.findByTestId('selected-node-id');

  expect(nodeID).toHaveTextContent('Aether Node (node123)');
  expect(screen.getByTestId('selected-node-difficulty')).toHaveTextContent('Difficulty 2');

  expect(screen.getByRole('link', { name: 'Click to start' })).toHaveAttribute(
    'href',
    '/explore/current',
  );
});
