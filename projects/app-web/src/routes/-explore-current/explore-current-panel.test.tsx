import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { setSelectedNode } from '@vers/aether-client';
import type { ActivityAppState } from '@vers/idle-core';
import { removeSharedWorker } from '../../test-utils/remove-shared-worker';
import { withIdleWorkerHandle } from '../../test-utils/with-idle-worker-handle';
import { ExploreCurrentPanel } from './explore-current-panel';

interface SetActivityMessage {
  readonly activity: { readonly id: string };
  readonly type: 'set-activity';
}

function isSetActivityMessage(value: unknown): value is SetActivityMessage {
  return (
    typeof value === 'object' && value !== null && 'type' in value && value.type === 'set-activity'
  );
}

function buildFakeActivityAppState(id: string): ActivityAppState {
  return {
    currentEnemyGroup: null,
    elapsed: 0,
    enemiesRemaining: 0,
    enemyGroups: [],
    enemyGroupsRemaining: 0,
    id,
    name: 'Aether Node',
  };
}

test('it shows a spinner and sends initialize before the worker reports its state', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  setSelectedNode(null);

  await withIdleWorkerHandle({ activity: undefined, initialized: false, worker }, () => {
    render(<ExploreCurrentPanel />);
  });

  expect(calls).toStrictEqual([{ type: 'initialize' }]);
  expect(screen.queryByTestId('aether-node-codex-stub')).not.toBeInTheDocument();
});

test('it reports the simulation as unavailable when SharedWorker is unsupported', async () => {
  setSelectedNode(null);
  removeSharedWorker();

  await withIdleWorkerHandle({ activity: undefined, initialized: false, worker: undefined }, () => {
    render(<ExploreCurrentPanel />);
  });

  expect(screen.getByRole('status')).toHaveTextContent(/activity simulation is unavailable/i);
});

test('it sends set-activity once initialized but the worker has not caught up yet', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  setSelectedNode(null);

  await withIdleWorkerHandle({ activity: undefined, initialized: true, worker }, () => {
    render(<ExploreCurrentPanel />);
  });

  expect(calls).toHaveLength(1);

  const [sentMessage] = calls;

  if (!isSetActivityMessage(sentMessage)) {
    throw new Error('expected a set-activity message');
  }

  expect(sentMessage.activity.id).toBeString();
  expect(screen.queryByTestId('aether-node-codex-stub')).not.toBeInTheDocument();
});

test('it renders the node and its codex fragment once the worker reports the sent activity', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  setSelectedNode(null);

  // a first render captures which activity id the panel sent, so the second render can report
  // the worker as having caught up to that exact activity
  await withIdleWorkerHandle({ activity: undefined, initialized: true, worker }, () => {
    render(<ExploreCurrentPanel />);
  });

  const [sentMessage] = calls;

  if (!isSetActivityMessage(sentMessage)) {
    throw new Error('expected a set-activity message');
  }

  await withIdleWorkerHandle(
    {
      activity: buildFakeActivityAppState(sentMessage.activity.id),
      initialized: true,
      worker,
    },
    async () => {
      render(<ExploreCurrentPanel />);

      const codex = await screen.findByTestId('aether-node-codex-stub');

      expect(codex).toBeVisible();
    },
  );
});
