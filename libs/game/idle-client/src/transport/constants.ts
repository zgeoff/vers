/**
 * The BroadcastChannel name every worker-state broadcast rides, from both the `SharedWorker` and
 * the elected web-locks writer alike. Per-origin, like the writer lock: one origin is one game
 * deployment, and channels scope to the browser profile.
 */
export const WORKER_TO_CLIENT_CHANNEL = 'vers-idle-worker-to-client';

/**
 * BroadcastChannel names carrying the web-locks path's oRPC traffic, split by direction and kept
 * off `WORKER_TO_CLIENT_CHANNEL` so a state broadcast never collides with an RPC frame. Every
 * frame envelopes with its sending tab's id — the raw channel carries every tab's traffic at once.
 */
export const RPC_CLIENT_TO_WORKER_CHANNEL = 'vers-idle-rpc-client-to-worker';
export const RPC_WORKER_TO_CLIENT_CHANNEL = 'vers-idle-rpc-worker-to-client';

/**
 * The exclusive lock every tab's dedicated worker races; the holder is the browser profile's one
 * simulation writer.
 */
export const WRITER_LOCK_NAME = 'vers-idle-writer';
