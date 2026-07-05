import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setSelectedNode } from '@vers/aether-client';
import type { AetherNode } from '@vers/aether-core';
import { nodeHasText } from '@vers/client-test-utils';
import { createRoutesStub } from 'react-router';
import { expect, test } from 'vitest';
import { Routes } from '../../types';
import { SelectedNodeInfo } from './selected-node-info';

function setupTest() {
  const user = userEvent.setup();

  const RouteStub = createRoutesStub([
    {
      Component: () => <SelectedNodeInfo />,
      path: '/',
    },
    {
      Component: () => 'AETHER_NODE_ROUTE',
      path: Routes.AetherNode,
    },
  ]);

  render(<RouteStub />);

  return { user };
}

test('it displays information about the selected node', () => {
  const node: AetherNode = {
    connections: ['conn1', null, 'conn2', null],
    difficulty: 2,
    id: 'node123',
    index: 3,
    position: [1.2345, 6.789],
    seed: 12_345,
  };

  setSelectedNode(node, null);

  setupTest();

  const nodeID = screen.getByText('Test Aether Node (node123)');
  const [difficulty] = screen.getAllByText(nodeHasText('Difficulty 2'));

  expect(nodeID).toBeInTheDocument();
  expect(difficulty).toBeInTheDocument();
});

test('it redirects to the aether node route when the start button is clicked', async () => {
  const node: AetherNode = {
    connections: ['conn1', null, 'conn2', null],
    difficulty: 2,
    id: 'node123',
    index: 3,
    position: [1.2345, 6.789],
    seed: 12_345,
  };

  setSelectedNode(node, null);

  const { user } = setupTest();

  const startButton = screen.getByRole('link', { name: 'Click to start' });

  await user.click(startButton);

  expect(screen.getByText('AETHER_NODE_ROUTE')).toBeInTheDocument();
});
