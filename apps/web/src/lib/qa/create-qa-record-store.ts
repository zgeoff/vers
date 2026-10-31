import * as Sentry from '@sentry/react';
import { QA_RECORD_KEYS } from './qa-record-keys';
import { readQARecords } from './read-qa-records';
import { readRefusalCaptures } from './read-refusal-captures';
import type { QARecordStorage, QARecordStore } from './types';
import { updateQARecords } from './update-qa-records';

const MAX_RECEIVED_OUTCOMES = 50;

// a refusal can repeat while the network stays down, so storage keeps the newest 10 captures, and
// a phone's storage quota never fills with them
const MAX_REFUSAL_CAPTURES = 10;

// a phone throttles a hidden tab's timers to about once a minute, so a live tab can finish a
// capture long after its worker wait; only a capture this old belongs to a page that closed
const PENDING_CAPTURE_LIFETIME_MS = 10 * 60 * 1000;

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

  // each capture's own worker wait is bounded, so waiting on every capture in flight is too
  const inFlight = new Set<Promise<void>>();

  const removeWhenSettled = async (capture: Promise<void>): Promise<void> => {
    await Promise.allSettled([capture]);

    inFlight.delete(capture);
  };

  return {
    // each capture lives under its own key, so a tab that writes one capture never touches
    // another tab's capture
    addCapture: (capture) => {
      withGuard(() => {
        const captureStorage = storage.captures();

        captureStorage.setItem(
          `${QA_RECORD_KEYS.refusalCapturePrefix}${capture.captureID}`,
          JSON.stringify({
            ...capture,
            pendingUntil: capture.capturedAt + PENDING_CAPTURE_LIFETIME_MS,
            status: 'pending',
          }),
        );

        const stored = readRefusalCaptures(captureStorage);

        for (const evicted of stored.slice(0, -MAX_REFUSAL_CAPTURES)) {
          captureStorage.removeItem(evicted.key);
        }
      }, undefined);
    },
    addReceivedOutcome: (record) => {
      withGuard(() => {
        updateQARecords({
          key: QA_RECORD_KEYS.receivedOutcomes,
          storage: storage.outcomes(),
          update: (outcomes) => [...outcomes, record].slice(-MAX_RECEIVED_OUTCOMES),
        });
      }, undefined);
    },
    completeCapture: (captureID, workerPart) => {
      withGuard(() => {
        const captureStorage = storage.captures();
        const key = `${QA_RECORD_KEYS.refusalCapturePrefix}${captureID}`;

        // a capture past the limit was evicted on purpose, so its answer has nothing to join
        const stored = readRefusalCaptures(captureStorage).find((entry) => entry.key === key);

        if (stored !== undefined) {
          captureStorage.setItem(
            key,
            JSON.stringify({ ...stored.capture, ...workerPart, status: 'complete' }),
          );
        }
      }, undefined);
    },
    readFailures: () => Object.freeze([...failures]),
    readReceivedOutcomes: () =>
      withGuard(() => readQARecords(storage.outcomes(), QA_RECORD_KEYS.receivedOutcomes), []),
    recordFailure,
    settleCaptures: async () => {
      await Promise.allSettled(inFlight);
    },
    takeCaptures: (now) =>
      withGuard(() => {
        const captureStorage = storage.captures();
        const stored = readRefusalCaptures(captureStorage);

        // a pending capture stays for its owner's worker answer, whichever tab or registration
        // asks, until its lifetime shows its page closed
        for (const entry of stored) {
          if (entry.capture.status === 'complete' || entry.capture.pendingUntil <= now) {
            captureStorage.removeItem(entry.key);
          }
        }

        return stored.map((entry) => entry.capture);
      }, []),
    trackCapture: (capture) => {
      inFlight.add(capture);
      void removeWhenSettled(capture);
    },
  };
}
