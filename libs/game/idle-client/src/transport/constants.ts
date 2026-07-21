/**
 * BroadcastChannel names bridging tabs and the elected writer worker, split by direction so a tab
 * never receives another tab's client messages. Per-origin, like the writer lock: one origin is
 * one game deployment, and channels scope to the browser profile.
 */
export const CLIENT_TO_WORKER_CHANNEL = 'vers-idle-client-to-worker';
export const WORKER_TO_CLIENT_CHANNEL = 'vers-idle-worker-to-client';

/**
 * The exclusive lock every tab's dedicated worker races; the holder is the browser profile's one
 * simulation writer.
 */
export const WRITER_LOCK_NAME = 'vers-idle-writer';
