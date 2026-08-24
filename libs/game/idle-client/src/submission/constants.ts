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
export const CHECKPOINT_QUEUE_DB_VERSION = 7;
export const CHECKPOINT_QUEUE_STORE_NAME = 'pending-checkpoints';

/**
 * The object store caching published content documents by `contentVersion` — immutable once
 * published, so a cached row never needs invalidation, only a self-healing overwrite on a failed
 * parse.
 */
export const CONTENT_DOCUMENT_STORE_NAME = 'content-documents';

/**
 * The object store caching a revealed world-map node's start inputs — genesis seed, current head,
 * encounter, and content version — by its `[avatarID, nodeID]` pair, so the worker holds every
 * input on-device for every node the player can already see before a start needs one. The compound
 * key scopes each row to its avatar — a genesis seed is per avatar, so two avatars sharing a
 * coordinate keep separate rows.
 */
export const NODE_SEEDS_STORE_NAME = 'node-seeds';

/**
 * The object store holding the full `ActivityData` a local start mints, keyed by its own `id`.
 * This is the client-minted activity start a later reconcile drains and verifies against the
 * server; it is written durably before the row installs, so a crash between mint and install still
 * leaves a recoverable activity start.
 */
export const PENDING_ACTIVITY_STARTS_STORE_NAME = 'pending-activity-starts';

/**
 * The `preferences` record holding `revealNodes`'s avatar- and account-global crypto stamps. A
 * worker drives one avatar's simulation at a time, so a single record suffices: a newer reveal
 * overwrites the stamps in place with the account's current ones.
 */
export const START_STAMPS_KEY = 'start-stamps';

/**
 * The `preferences` object store's one record key. A worker drives one avatar's simulation at a
 * time, so a single record holds the failure-action preference: the last set wins, and the
 * record's own `avatarID` decides whether a resync may flush a dirty value — a dirty value reaches
 * the server only for the avatar it was set for.
 */
export const FAILURE_ACTION_PREFERENCE_KEY = 'failure-action';

/**
 * The `preferences` record holding the one undelivered stop intent. A worker drives one avatar's
 * simulation at a time, so a single record suffices: a newer stop overwrites an older one, whose
 * target row the newer run's own start flow has already closed server-side.
 */
export const PENDING_STOP_INTENT_KEY = 'pending-stop';

/**
 * The `preferences` record holding the avatar's last-started activity id. A worker drives one
 * avatar's simulation at a time, so a single record suffices, scoped by `avatarID`.
 */
export const LAST_STARTED_ACTIVITY_KEY = 'last-started-activity';
export const PREFERENCES_STORE_NAME = 'preferences';

/**
 * The store name an older database version held this same outbox under. The upgrade deletes it, so
 * a device carrying one keeps no second copy of the outbox.
 */
export const LEGACY_PENDING_ACTIVITY_STARTS_STORE_NAME = 'pending-roots';
