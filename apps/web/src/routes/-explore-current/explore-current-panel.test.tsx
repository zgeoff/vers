import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ActivitySnapshot } from '@vers/idle-core';
import { ActivityFailureAction } from '@vers/idle-core';
import { setSelectedNode } from '@vers/worldmap-client';
import { removeSharedWorker } from '../../test-utils/remove-shared-worker';
import { withIdleWorkerHandle } from '../../test-utils/with-idle-worker-handle';
import { ExploreCurrentPanel } from './explore-current-panel';

interface SetActivityMessage {
  readonly activity: { readonly id: string };
  readonly type: 'set_activity';
}

function isSetActivityMessage(value: unknown): value is SetActivityMessage {
  return (
    typeof value === 'object' && value !== null && 'type' in value && value.type === 'set_activity'
  );
}

function buildFakeActivitySnapshot(id: string): ActivitySnapshot {
  return {
    currentWave: null,
    elapsed: 0,
    enemiesRemaining: 0,
    id,
    levelUp: null,
    name: 'World Map Encounter',
    rewards: { xp: 0 },
    waves: [],
    wavesRemaining: 0,
  };
}

test('it shows a spinner and sends initialize before the worker reports its state', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  setSelectedNode(null);

  await withIdleWorkerHandle(
    {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker,
    },
    () => {
      render(<ExploreCurrentPanel />);
    },
  );

  expect(calls).toStrictEqual([{ type: 'initialize' }]);
  expect(screen.queryByTestId('world-map-node-codex-stub')).not.toBeInTheDocument();
});

test('it reports the simulation as unavailable when SharedWorker is unsupported', async () => {
  setSelectedNode(null);
  removeSharedWorker();

  await withIdleWorkerHandle(
    {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker: undefined,
    },
    () => {
      render(<ExploreCurrentPanel />);
    },
  );

  expect(screen.getByRole('status')).toHaveTextContent(/activity simulation is unavailable/i);
});

test('it sends set-activity once initialized but the worker has not caught up yet', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  setSelectedNode(null);

  await withIdleWorkerHandle(
    { activity: undefined, failureAction: ActivityFailureAction.Abort, initialized: true, worker },
    () => {
      render(<ExploreCurrentPanel />);
    },
  );

  expect(calls).toHaveLength(1);

  const [sentMessage] = calls;

  if (!isSetActivityMessage(sentMessage)) {
    throw new Error('expected a set-activity message');
  }

  expect(sentMessage.activity.id).toBeString();
  expect(screen.queryByTestId('world-map-node-codex-stub')).not.toBeInTheDocument();
});

test('it renders the node and its codex fragment once the worker reports the sent activity', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  setSelectedNode(null);

  // a first render captures which activity id the panel sent, so the second render can report
  // the worker as having caught up to that exact activity
  await withIdleWorkerHandle(
    { activity: undefined, failureAction: ActivityFailureAction.Abort, initialized: true, worker },
    () => {
      render(<ExploreCurrentPanel />);
    },
  );

  const [sentMessage] = calls;

  if (!isSetActivityMessage(sentMessage)) {
    throw new Error('expected a set-activity message');
  }

  await withIdleWorkerHandle(
    {
      activity: buildFakeActivitySnapshot(sentMessage.activity.id),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      worker,
    },
    async () => {
      render(<ExploreCurrentPanel />);

      const codex = await screen.findByTestId('world-map-node-codex-stub');

      expect(codex).toBeVisible();
    },
  );
});

test('it renders the auto-retry checkbox unchecked by default and dispatches the toggle', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };
  const user = userEvent.setup();

  setSelectedNode(null);

  // a first render captures which activity id the panel sent, so the second render can report
  // the worker as having caught up to that exact activity
  await withIdleWorkerHandle(
    { activity: undefined, failureAction: ActivityFailureAction.Abort, initialized: true, worker },
    () => {
      render(<ExploreCurrentPanel />);
    },
  );

  const [sentMessage] = calls;

  if (!isSetActivityMessage(sentMessage)) {
    throw new Error('expected a set-activity message');
  }

  await withIdleWorkerHandle(
    {
      activity: buildFakeActivitySnapshot(sentMessage.activity.id),
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      worker,
    },
    async () => {
      render(<ExploreCurrentPanel />);

      const checkbox = screen.getByLabelText('Auto-retry on failure');

      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);

      expect(calls).toContainEqual({
        failureAction: ActivityFailureAction.Retry,
        type: 'set_failure_action',
      });
    },
  );
});
