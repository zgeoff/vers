/**
 * Lowercases and collapses anything outside [a-z0-9] to single underscores so
 * a branch name (slashes, dots, uppercase) becomes a postgres identifier-safe
 * fragment. Every composer of test-template database names must use this
 * same mapping, or the sweep's branch matching breaks.
 */
export function normalizeDBPart(part: string): string {
  return part
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');
}
