import { expect, mock, test } from 'bun:test';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { createSimulation } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { mockActivityService } from '@vers/mock-services/activity';
import { HttpResponse } from 'msw';
import { server } from '../mocks/node';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';
import { createMockWorkerContext } from '../test-utils/factories/create-mock-worker-context';
import type { WorkerMessage } from '../types';
import { WorkerMessageType } from '../types';
import { runContinuation } from './run-continuation';

function buildSpySubmitter(): CheckpointSubmitter {
  return {
    flushHeld: mock(() => Promise.resolve()),
    registerActivity: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve<number | undefined>(undefined)),
  };
}

test('it adopts a fresh server-started row for the same scope and registers from a zero cursor', async () => {
  const startedActivity = createMockActivityData();

  server.use(mockActivityService.startActivity.handler(() => startedActivity));

  const submitter = buildSpySubmitter();
  const context = createMockWorkerContext({ submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(simulation.activity?.id).toBe(startedActivity.id);
  expect(context.getActivity()).toStrictEqual(startedActivity);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: startedActivity.id,
    appendedHead: 0,
    lastHash: startedActivity.startHash,
    startChainIndex: startedActivity.startChainIndex,
  });
});

test('it adopts the CONFLICT payload row when one is already active for the scope', async () => {
  const conflictingActivity = createMockActivityData();

  server.use(
    mockActivityService.startActivity.handler((opts) => {
      throw opts.errors.CONFLICT({ data: { activity: conflictingActivity } });
    }),
  );

  const submitter = buildSpySubmitter();
  const context = createMockWorkerContext({ submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(simulation.activity?.id).toBe(conflictingActivity.id);
  expect(context.getActivity()).toStrictEqual(conflictingActivity);

  expect(submitter.registerActivity).toHaveBeenCalledExactlyOnceWith({
    activityID: conflictingActivity.id,
    appendedHead: 0,
    lastHash: conflictingActivity.startHash,
    startChainIndex: conflictingActivity.startChainIndex,
  });
});

test('it stops the simulation and broadcasts offline on a transport failure', async () => {
  server.use(mockActivityService.startActivity.handler(() => HttpResponse.error()));

  const channel = new MessageChannel();

  const received: Array<WorkerMessage> = [];

  channel.port2.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    received.push(event.data);
  });

  channel.port2.start();

  const submitter = buildSpySubmitter();
  const context = createMockWorkerContext({ connections: [channel.port1], submitter });
  const simulation = createSimulation();
  const previousActivity = createMockActivityData();

  simulation.startActivity(createMockAvatarData(), createMockActivityInput());

  await runContinuation(context, simulation, previousActivity);

  expect(simulation.activity).toBeNull();
  expect(submitter.registerActivity).not.toHaveBeenCalled();

  for (let attempt = 0; attempt < 200 && received.length === 0; attempt += 1) {
    await new Promise((resolve) => {
      setTimeout(resolve, 1);
    });
  }

  expect(received).toStrictEqual([{ online: false, type: WorkerMessageType.ConnectionStatus }]);
});
