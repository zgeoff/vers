/**
 * How often accumulated progress checkpoints flush to `trackActivityProgress`. A terminal
 * checkpoint (completed or failed) flushes immediately instead, to bound reward-reveal latency.
 */
export const PROGRESS_FLUSH_INTERVAL_MS = 10_000;

/**
 * The checkpoint payload's `entropySource` tag for every checkpoint this client submits. The
 * concrete vocabulary beyond this single value is out of scope here.
 */
export const ENTROPY_SOURCE_CHAIN = 'chain';

/**
 * The pending-submit queue's IndexedDB database name and version.
 */
export const CHECKPOINT_QUEUE_DB_NAME = 'vers-idle-checkpoint-queue';
export const CHECKPOINT_QUEUE_DB_VERSION = 1;

/**
 * The pending-submit queue's one object store, keyed `[activityID, version]`.
 */
export const CHECKPOINT_QUEUE_STORE_NAME = 'pending-checkpoints';
