/**
 * How often accumulated progress checkpoints flush to the activity service. A terminal checkpoint
 * (completed or failed) flushes immediately instead, to bound reward-reveal latency.
 */
export const PROGRESS_FLUSH_INTERVAL_MS = 10_000;

/**
 * The checkpoint payload's `entropySource` tag for every checkpoint this client submits: a
 * server-custody roll.
 */
export const ENTROPY_SOURCE_SERVER_KEY = 'server-key';
export const CHECKPOINT_QUEUE_DB_NAME = 'vers-idle-checkpoint-queue';
export const CHECKPOINT_QUEUE_DB_VERSION = 1;
export const CHECKPOINT_QUEUE_STORE_NAME = 'pending-checkpoints';
