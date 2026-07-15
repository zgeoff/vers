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
 * The base delay a held batch's retry backs off from, doubling per consecutive failure up to
 * `RETRY_BACKOFF_CAP_MS` — a held batch's first retry waits exactly one progress-flush window.
 */
export const RETRY_BACKOFF_BASE_MS = 10_000;

/**
 * The ceiling a held batch's exponential retry backoff never exceeds.
 */
export const RETRY_BACKOFF_CAP_MS = 300_000;
export const CHECKPOINT_QUEUE_DB_NAME = 'vers-idle-checkpoint-queue';
export const CHECKPOINT_QUEUE_DB_VERSION = 1;
export const CHECKPOINT_QUEUE_STORE_NAME = 'pending-checkpoints';
