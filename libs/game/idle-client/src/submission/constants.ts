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
 * The ceiling a held batch's exponential retry backoff never exceeds. The backoff's base is
 * `PROGRESS_FLUSH_INTERVAL_MS`: a held batch's first retry waits exactly one flush window.
 */
export const RETRY_BACKOFF_CAP_MS = 300_000;

/**
 * How many consecutive flushes must fail without a defined contract outcome — a transport
 * failure or an undeclared server error — before the submitter reports the stream as stalled. A
 * success or a defined contract error resets the streak.
 */
export const FLUSH_STALL_THRESHOLD = 3;
export const CHECKPOINT_QUEUE_DB_NAME = 'vers-idle-checkpoint-queue';
export const CHECKPOINT_QUEUE_DB_VERSION = 2;
export const CHECKPOINT_QUEUE_STORE_NAME = 'pending-checkpoints';

/**
 * The `preferences` object store's one record key. A worker drives one avatar's simulation at a
 * time, so a single record holds the failure-action preference: the last set wins, and the
 * record's own `avatarID` decides whether a resync may flush a dirty value — a dirty value reaches
 * the server only for the avatar it was set for.
 */
export const FAILURE_ACTION_PREFERENCE_KEY = 'failure-action';
export const PREFERENCES_STORE_NAME = 'preferences';
