import { z } from 'zod';
import type { CDPClient, CDPEvent, SendOptions } from './types';

const DEFAULT_SEND_TIMEOUT_MS = 20_000;
const DEFAULT_WAIT_TIMEOUT_MS = 20_000;

const messageSchema = z.object({
  error: z.object({ message: z.string() }).optional(),
  id: z.number().optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
});

interface PendingCall {
  readonly method: string;
  readonly reject: (error: Error) => void;
  readonly resolve: (value: unknown) => void;
}

export async function createCDPClient(socketURL: string): Promise<CDPClient> {
  const socket = new WebSocket(socketURL);
  const pending = new Map<number, PendingCall>();
  const listeners = new Set<(event: CDPEvent) => void>();

  let nextID = 1;

  const closed = new Promise<void>((resolve) => {
    socket.addEventListener('close', () => {
      for (const call of pending.values()) {
        call.reject(new Error(`${call.method}: the socket closed before it answered`));
      }

      pending.clear();

      resolve();
    });
  });

  socket.addEventListener('message', (event) => {
    const message = messageSchema.parse(JSON.parse(String(event.data)));

    if (message.id !== undefined) {
      const call = pending.get(message.id);

      pending.delete(message.id);

      if (call === undefined) {
        return;
      }

      if (message.error === undefined) {
        call.resolve(message.result);
      } else {
        call.reject(new Error(`${call.method}: ${message.error.message}`));
      }

      return;
    }

    if (message.method !== undefined) {
      for (const listener of listeners) {
        listener({ method: message.method, params: message.params });
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    socket.addEventListener('open', () => {
      resolve();
    });

    socket.addEventListener('error', () => {
      reject(new Error(`could not open ${socketURL}`));
    });
  });

  const send = (
    method: string,
    params: Readonly<Record<string, unknown>> = {},
    options: SendOptions = {},
  ): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const id = nextID++;
      const timeoutMS = options.timeoutMS ?? DEFAULT_SEND_TIMEOUT_MS;

      const timer = setTimeout(() => {
        pending.delete(id);

        reject(new Error(`${method}: no answer within ${timeoutMS}ms`));
      }, timeoutMS);

      pending.set(id, {
        method,
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
      });

      socket.send(JSON.stringify({ id, method, params }));
    });

  const subscribe = (listener: (event: CDPEvent) => void): (() => void) => {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  };

  const waitFor = (method: string, timeoutMS = DEFAULT_WAIT_TIMEOUT_MS): Promise<unknown> =>
    new Promise((resolve, reject) => {
      const unsubscribe = subscribe((event) => {
        if (event.method === method) {
          clearTimeout(timer);
          unsubscribe();
          resolve(event.params);
        }
      });

      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`no ${method} event within ${timeoutMS}ms`));
      }, timeoutMS);

      void (async () => {
        await closed;

        clearTimeout(timer);
        unsubscribe();
        reject(new Error(`${method}: the socket closed before the event`));
      })();
    });

  return {
    close: () => {
      socket.close();
    },
    closed,
    send,
    subscribe,
    waitFor,
  };
}
