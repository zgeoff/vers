import * as z from 'zod';
import { QA_RECORD_KEYS } from './qa-record-keys';
import type { StoredRefusalCapture } from './types';

export function readRefusalCaptures(storage: Storage): ReadonlyArray<StoredRefusalCapture> {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => key?.startsWith(QA_RECORD_KEYS.refusalCapturePrefix) === true,
  );

  const captures = keys.flatMap((key) => {
    const capture = parseStoredCapture(storage.getItem(key));

    return capture === null ? [] : [{ capture, key }];
  });

  return captures.toSorted((left, right) => left.capture.capturedAt - right.capture.capturedAt);
}

const StoredCaptureSchema = z.looseObject({
  captureID: z.string(),
  capturedAt: z.number(),
  pendingUntil: z.number(),
  status: z.enum(['complete', 'pending']),
});

function parseStoredCapture(stored: null | string): null | StoredRefusalCapture['capture'] {
  if (stored === null) {
    return null;
  }

  try {
    const parsed = StoredCaptureSchema.safeParse(JSON.parse(stored));

    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
