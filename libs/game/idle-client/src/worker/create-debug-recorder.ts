import type { IngestActivityStartOutcome, StartRefusal } from '../submission/ingest-activity-start';
import type { FlushOutcome } from '../submission/run-checkpoint-flush-attempt';

const DEBUG_EVENT_CAPACITY = 200;

export type DebugEventType =
  | 'connectivity'
  | 'flush'
  | 'lifecycle'
  | 'resync'
  | 'run'
  | 'start'
  | 'start-ingest'
  | 'stream'
  | 'writer';

export interface DebugEvent {
  readonly at: number;
  readonly detail: string;
  readonly type: DebugEventType;
}

export interface StartAttemptRecord {
  readonly attempts: number;
  readonly lastAttemptAt: number;
  readonly lastOutcome: IngestActivityStartOutcome;
  readonly lastRefusal: null | StartRefusal;
}

export interface FlushRecord {
  readonly appendedHead: null | number;
  readonly at: number;
  readonly reason: null | string;
  readonly type: FlushOutcome['type'];
}

export interface DebugRecorder {
  readonly bootedAt: number;
  readonly getEvents: () => ReadonlyArray<DebugEvent>;
  readonly getFlushRecords: () => ReadonlyMap<string, FlushRecord>;
  readonly getStartAttempts: () => ReadonlyMap<string, StartAttemptRecord>;
  readonly recordEvent: (type: DebugEventType, detail: string) => void;
  readonly recordFlush: (activityID: string, outcome: Readonly<FlushOutcome>) => void;

  readonly recordStartAttempt: (
    activityID: string,
    outcome: IngestActivityStartOutcome,
    refusal: null | StartRefusal,
  ) => void;

  readonly workerID: string;
}

interface CreateDebugRecorderOptions {
  readonly capacity?: number;
  readonly now?: () => number;
  readonly workerID?: string;
}

export function createDebugRecorder(
  options: Readonly<CreateDebugRecorderOptions> = {},
): DebugRecorder {
  const capacity = options.capacity ?? DEBUG_EVENT_CAPACITY;
  const now = options.now ?? (() => Date.now());
  const workerID = options.workerID ?? crypto.randomUUID();
  const bootedAt = now();
  const ring: Array<DebugEvent> = [];
  let writeIndex = 0;

  const flushRecords = new Map<string, FlushRecord>();
  const startAttempts = new Map<string, StartAttemptRecord>();

  const recordEvent = (type: DebugEventType, detail: string): void => {
    ring[writeIndex] = { at: now(), detail, type };
    writeIndex = (writeIndex + 1) % capacity;
  };

  const getEvents = (): ReadonlyArray<DebugEvent> => {
    if (ring.length < capacity) {
      return [...ring];
    }

    return [...ring.slice(writeIndex), ...ring.slice(0, writeIndex)];
  };

  const recordFlush = (activityID: string, outcome: Readonly<FlushOutcome>): void => {
    const record: FlushRecord = {
      appendedHead: 'appendedHead' in outcome ? (outcome.appendedHead ?? null) : null,
      at: now(),
      reason: 'reason' in outcome ? outcome.reason : null,
      type: outcome.type,
    };

    flushRecords.set(activityID, record);

    recordEvent('flush', formatFlushDetail(activityID, record));
  };

  const recordStartAttempt = (
    activityID: string,
    outcome: IngestActivityStartOutcome,
    refusal: null | StartRefusal,
  ): void => {
    const previous = startAttempts.get(activityID);

    startAttempts.set(activityID, {
      attempts: (previous?.attempts ?? 0) + 1,
      lastAttemptAt: now(),
      lastOutcome: outcome,
      lastRefusal: refusal,
    });

    recordEvent('start-ingest', formatStartAttemptDetail(activityID, outcome, refusal));
  };

  return {
    bootedAt,
    getEvents,
    getFlushRecords: () => flushRecords,
    getStartAttempts: () => startAttempts,
    recordEvent,
    recordFlush,
    recordStartAttempt,
    workerID,
  };
}

function formatFlushDetail(activityID: string, record: Readonly<FlushRecord>): string {
  const head = record.appendedHead === null ? '' : ` head=${record.appendedHead}`;
  const reason = record.reason === null ? '' : ` reason=${record.reason}`;

  return `${activityID} ${record.type}${head}${reason}`;
}

function formatStartAttemptDetail(
  activityID: string,
  outcome: IngestActivityStartOutcome,
  refusal: null | StartRefusal,
): string {
  if (refusal === null) {
    return `${activityID} ${outcome}`;
  }

  const reason = refusal.reason === null ? '' : `/${refusal.reason}`;

  return `${activityID} ${outcome} refused=${refusal.code}${reason}`;
}
