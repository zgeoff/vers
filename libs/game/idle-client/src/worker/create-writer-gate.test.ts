import { expect, mock, onTestFinished, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { createFakeWebLocks } from '../test-utils/create-fake-web-locks';
import { WORKER_TO_CLIENT_CHANNEL, WRITER_LOCK_NAME } from '../transport/constants';
import { WorkerMessageType } from '../types';
import { createWriterGate } from './create-writer-gate';

function setupTest() {
  const fake = createFakeWebLocks();
  const broadcasts: Array<unknown> = [];

  const channel = new BroadcastChannel(WORKER_TO_CLIENT_CHANNEL);

  channel.addEventListener('message', (event: MessageEvent<unknown>) => {
    broadcasts.push(event.data);
  });

  onTestFinished(() => {
    channel.close();
  });

  return { broadcasts, fake };
}

test('it hands a connection to the runtime at once when the writer lock is free', async () => {
  const ctx = setupTest();
  const handleConnect = mock<(event: MessageEvent) => void>();

  const gate = createWriterGate({
    createRuntime: () => ({ handleConnect }),
    locks: ctx.fake.locks,
  });

  const event = new MessageEvent('connect', { ports: [new MessageChannel().port1] });

  gate.handleConnect(event);

  expect(handleConnect).toHaveBeenCalledExactlyOnceWith(event);

  await waitFor(() => {
    expect(ctx.broadcasts).toStrictEqual([{ type: WorkerMessageType.WriterReady }]);
  });
});

test('it holds connections while another worker owns the writer lock, and hands them over once elected', async () => {
  const ctx = setupTest();
  const handleConnect = mock<(event: MessageEvent) => void>();
  const createRuntime = mock(() => ({ handleConnect }));

  // another build's worker holds the origin-wide lock for as long as its tabs live
  void ctx.fake.locks.request(WRITER_LOCK_NAME, { mode: 'exclusive' }, () => new Promise(() => {}));
  const gate = createWriterGate({ createRuntime, locks: ctx.fake.locks });

  const first = new MessageEvent('connect', { ports: [new MessageChannel().port1] });
  const second = new MessageEvent('connect', { ports: [new MessageChannel().port1] });

  gate.handleConnect(first);
  gate.handleConnect(second);

  expect(createRuntime).not.toHaveBeenCalled();
  expect(handleConnect).not.toHaveBeenCalled();

  await waitFor(() => {
    expect(ctx.broadcasts).toStrictEqual([
      { type: WorkerMessageType.WriterPending },
      { type: WorkerMessageType.WriterPending },
    ]);
  });

  ctx.fake.advanceLockQueue(WRITER_LOCK_NAME);

  expect(createRuntime).toHaveBeenCalledOnce();
  expect(handleConnect.mock.calls).toStrictEqual([[first], [second]]);

  await waitFor(() => {
    expect(ctx.broadcasts.at(-1)).toStrictEqual({ type: WorkerMessageType.WriterReady });
  });
});

test('it rejects a connect event that carries no port', () => {
  const ctx = setupTest();

  const gate = createWriterGate({
    createRuntime: () => ({ handleConnect: () => {} }),
    locks: ctx.fake.locks,
  });

  expect(() => {
    gate.handleConnect(new MessageEvent('connect'));
  }).toThrow();
});
