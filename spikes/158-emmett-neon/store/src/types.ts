import type { Event } from '@event-driven-io/emmett';

/** One simulation checkpoint inside a batch submitted by the client. */
export type Checkpoint = {
  tick: number;
  progress: number;
  statsDelta: Record<string, number>;
};

export type ActivityStarted = Event<
  'ActivityStarted',
  {
    activityId: string;
    seed: string;
    difficulty: number;
    startedAt: string;
  }
>;

/**
 * A batch of client-simulated checkpoints. `prevHash` links to the previous
 * event's `hash`, forming the per-activity hash chain the verifier replays.
 */
export type CheckpointBatchRecorded = Event<
  'CheckpointBatchRecorded',
  {
    checkpoints: Checkpoint[];
    progress: number;
    prevHash: string;
    hash: string;
    recordedAt: string;
  }
>;

export type ActivityCompleted = Event<
  'ActivityCompleted',
  {
    finalProgress: number;
    prevHash: string;
    hash: string;
    completedAt: string;
  }
>;

export type ActivityEvent = ActivityStarted | CheckpointBatchRecorded | ActivityCompleted;

/** Inline-projection document: latest progress per activity stream. */
export type ActivityProgressDoc = {
  activityId: string;
  status: 'active' | 'completed';
  progress: number;
  lastHash: string;
  batchCount: number;
  startedAt: string;
  updatedAt: string;
};
