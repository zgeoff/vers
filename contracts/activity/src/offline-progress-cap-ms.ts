/**
 * Ceiling on the simulated-time budget an avatar can accrue while away, in milliseconds. The server
 * banks wall-clock elapsed into each avatar's budget up to this value and debits every accepted
 * checkpoint batch's simulated-time delta against it; the client plans its offline fast-forward to
 * stop at the last encounter boundary at or under the same bound, so an honest stream never trips
 * the server's check.
 */
export const OFFLINE_PROGRESS_CAP_MS = 24 * 60 * 60 * 1000;
