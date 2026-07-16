import { expect } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import type { ClientMessage, WorkerMessage } from '../types';

export interface TestConnection {
  /**
   * The end handed to the system under test — a worker context's `connections` entry or a connect
   * event's port.
   */
  readonly port: MessagePort;

  /**
   * Every message the system under test posted back, in arrival order.
   */
  readonly received: ReadonlyArray<WorkerMessage>;

  /**
   * Posts a client message from the test's end of the channel.
   */
  readonly post: (message: ClientMessage) => void;

  /**
   * Resolves once at least `count` messages have arrived; rethrows the failed length assertion
   * when the wait times out, so a missing broadcast fails loudly at the wait itself.
   */
  readonly waitForMessages: (count: number) => Promise<void>;
}

/**
 * One test-side end of a worker message channel: records every broadcast for assertion and can
 * post client messages, replacing per-file MessageChannel wiring and hand-rolled polling loops.
 */
export function createTestConnection(): TestConnection {
  const channel = new MessageChannel();

  const received: Array<WorkerMessage> = [];

  channel.port2.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
    received.push(event.data);
  });

  channel.port2.start();

  return {
    port: channel.port1,
    post: (message) => {
      channel.port2.postMessage(message);
    },
    received,
    waitForMessages: async (count) => {
      await waitFor(() => {
        expect(received.length).toBeGreaterThanOrEqual(count);
      });
    },
  };
}
