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

/**
 * How many consecutive flushes must fail without reaching the activity service before the
 * submitter reports the stream as stalled. Any answered request — success or a defined contract
 * error — resets the streak.
 */
export const FLUSH_STALL_THRESHOLD = 3;
export const CHECKPOINT_QUEUE_DB_NAME = 'vers-idle-checkpoint-queue';
export const CHECKPOINT_QUEUE_DB_VERSION = 1;
export const CHECKPOINT_QUEUE_STORE_NAME = 'pending-checkpoints';
