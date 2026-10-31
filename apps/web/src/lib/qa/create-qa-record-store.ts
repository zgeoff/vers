import * as Sentry from '@sentry/react';
import * as z from 'zod';
import { QA_RECORD_KEYS } from './qa-record-keys';
import { readQARecords } from './read-qa-records';
import type { QARecordStorage, QARecordStore } from './types';
import { updateQARecords } from './update-qa-records';

const MAX_RECEIVED_OUTCOMES = 50;

// a refusal can repeat while the network stays down, so storage keeps the latest 10 captures, and
// a phone's storage quota never fills with them
const MAX_REFUSAL_CAPTURES = 10;

const StoredCaptureSchema = z.looseObject({
  captureID: z.string(),
  pendingUntil: z.number(),
  status: z.enum(['complete', 'pending']),
});

export function createQARecordStore(storage: Readonly<QARecordStorage>): QARecordStore {
  const failures: Array<string> = [];

  const recordFailure = (error: unknown): void => {
    failures.push(String(error));
    Sentry.captureException(error);
  };

  // storage can throw on any call, such as on a full quota or a blocked origin, so each call
  // records its failure in memory, where the next snapshot call reads it, and goes to the error
  // backend, which queues the report while the device is offline
  const withGuard = <T>(action: () => T, fallback: T): T => {
    try {
      return action();
    } catch (error) {
      recordFailure(error);

      return fallback;
    }
  };

  const updateCaptures = (update: (captures: ReadonlyArray<unknown>) => ReadonlyArray<unknown>) => {
    withGuard(() => {
      updateQARecords({ key: QA_RECORD_KEYS.refusalCaptures, storage: storage.captures, update });
    }, undefined);
  };

  return {
    addCapture: (capture) => {
      updateCaptures((captures) =>
        [...captures, { ...capture, status: 'pending' }].slice(-MAX_REFUSAL_CAPTURES),
      );
    },
    addReceivedOutcome: (record) => {
      withGuard(() => {
        updateQARecords({
          key: QA_RECORD_KEYS.receivedOutcomes,
          storage: storage.outcomes,
          update: (outcomes) => [...outcomes, record].slice(-MAX_RECEIVED_OUTCOMES),
        });
      }, undefined);
    },
    completeCapture: (captureID, workerPart) => {
      updateCaptures((captures) =>
        captures.map((stored) => {
          const parsed = StoredCaptureSchema.safeParse(stored);

          return parsed.success && parsed.data.captureID === captureID
            ? { ...parsed.data, ...workerPart, status: 'complete' }
            : stored;
        }),
      );
    },
    readFailures: () => Object.freeze([...failures]),
    readReceivedOutcomes: () =>
      withGuard(() => readQARecords(storage.outcomes, QA_RECORD_KEYS.receivedOutcomes), []),
    recordFailure,
    takeCaptures: (now) => {
      const captures = withGuard(
        () => readQARecords(storage.captures, QA_RECORD_KEYS.refusalCaptures),
        [],
      );

      // a capture whose worker answer can still land stays for the answer to join, whichever
      // registration of the hook asked; past its deadline, its page closed before the answer
      const stillPending = captures.filter((stored) => {
        const parsed = StoredCaptureSchema.safeParse(stored);

        return parsed.success && parsed.data.status === 'pending' && parsed.data.pendingUntil > now;
      });

      withGuard(() => {
        if (stillPending.length === 0) {
          storage.captures.removeItem(QA_RECORD_KEYS.refusalCaptures);
        } else {
          storage.captures.setItem(QA_RECORD_KEYS.refusalCaptures, JSON.stringify(stillPending));
        }
      }, undefined);

      return captures;
    },
  };
}
