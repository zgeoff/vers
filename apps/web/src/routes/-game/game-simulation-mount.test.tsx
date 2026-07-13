import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { withIdleWorkerHandle } from '../../test-utils/with-idle-worker-handle';
import { GameSimulationMount } from './game-simulation-mount';

test('it sends the initialize message once a worker connects that has not reported state yet', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  await withIdleWorkerHandle(
    { activity: undefined, failureAction: ActivityFailureAction.Abort, initialized: false, worker },
    () => {
      render(<GameSimulationMount />);
    },
  );

  expect(calls).toStrictEqual([{ type: 'initialize' }]);
});

test('it sends nothing once the worker has already reported its state', async () => {
  const calls: Array<unknown> = [];
  const worker = { port: { postMessage: (message: unknown) => calls.push(message) } };

  await withIdleWorkerHandle(
    { activity: undefined, failureAction: ActivityFailureAction.Abort, initialized: true, worker },
    () => {
      render(<GameSimulationMount />);
    },
  );

  expect(calls).toStrictEqual([]);
});

test('it sends nothing before a worker has connected', async () => {
  const calls: Array<unknown> = [];

  await withIdleWorkerHandle(
    {
      activity: undefined,
      failureAction: ActivityFailureAction.Abort,
      initialized: false,
      worker: undefined,
    },
    () => {
      render(<GameSimulationMount />);
      expect(calls).toStrictEqual([]);
    },
  );
});

test('it renders without error when the worker reports a stopped checkpoint stream', async () => {
  await withIdleWorkerHandle(
    {
      activity: undefined,
      checkpointStreamError: { activityID: 'activity_1', reason: 'broken-chain-link' },
      failureAction: ActivityFailureAction.Abort,
      initialized: true,
      worker: undefined,
    },
    () => {
      const rendered = render(<GameSimulationMount />);

      expect(rendered.container).toBeEmptyDOMElement();
    },
  );
});
