import { expect, mock, onTestFinished, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { WorkerMessageType } from '../types';
import { WORKER_TO_CLIENT_CHANNEL } from './constants';
import type { ReceivedRunOutcome } from './subscribe-to-run-outcomes';
import { subscribeToRunOutcomes } from './subscribe-to-run-outcomes';

function setupTest() {
  const sender = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  onTestFinished(() => {
    sender.close();
  });

  return { sender };
}

test('it reports each outcome a worker sends, with the sending worker', async () => {
  const ctx = setupTest();
  const onOutcome = mock<(received: Readonly<ReceivedRunOutcome>) => void>();

  onTestFinished(subscribeToRunOutcomes(onOutcome));

  ctx.sender.postMessage({
    outcome: { activityID: 'act_ended', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
    type: WorkerMessageType.ActivityEnded,
    workerID: 'worker_1',
  });

  await waitFor(() => {
    expect(onOutcome).toHaveBeenCalledExactlyOnceWith({
      outcome: { activityID: 'act_ended', avatarID: 'avatar_1', kind: 'refused', xp: 0 },
      workerID: 'worker_1',
    });
  });
});

test('it reports no sending worker for an outcome from a worker that stamps none', async () => {
  const ctx = setupTest();
  const onOutcome = mock<(received: Readonly<ReceivedRunOutcome>) => void>();

  onTestFinished(subscribeToRunOutcomes(onOutcome));

  ctx.sender.postMessage({
    outcome: { activityID: 'act_old', avatarID: 'avatar_1', kind: 'completed', xp: 12 },
    type: WorkerMessageType.ActivityEnded,
  });

  await waitFor(() => {
    expect(onOutcome).toHaveBeenCalledExactlyOnceWith({
      outcome: { activityID: 'act_old', avatarID: 'avatar_1', kind: 'completed', xp: 12 },
      workerID: null,
    });
  });
});

test('it ignores every other worker message', async () => {
  const ctx = setupTest();
  const onOutcome = mock<(received: Readonly<ReceivedRunOutcome>) => void>();

  onTestFinished(subscribeToRunOutcomes(onOutcome));

  ctx.sender.postMessage({
    activityID: 'act_started',
    type: WorkerMessageType.ActivityStartIngested,
  });

  ctx.sender.postMessage({
    outcome: { activityID: 'act_marker', avatarID: 'avatar_1', kind: 'failed', xp: 3 },
    type: WorkerMessageType.ActivityEnded,
    workerID: 'worker_1',
  });

  await waitFor(() => {
    expect(onOutcome).toHaveBeenCalledOnce();
  });

  expect(onOutcome).toHaveBeenCalledExactlyOnceWith({
    outcome: { activityID: 'act_marker', avatarID: 'avatar_1', kind: 'failed', xp: 3 },
    workerID: 'worker_1',
  });
});
