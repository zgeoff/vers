/**
 * Remaining offline-progress budget below which the worker starts reporting cap status to
 * connected tabs, so the player sees "reconnect to keep progressing" before the halt lands.
 */
export const OFFLINE_CAP_WARNING_MS = 3_600_000;
