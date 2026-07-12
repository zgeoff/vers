/**
 * Lowercases and collapses anything outside [a-z0-9] to single underscores so
 * hostnames and branch names (slashes, dots, uppercase) become postgres
 * identifier-safe fragments. Every composer of dev database names must use
 * this same mapping, or machine-scoped prefix matching breaks.
 */
export function normalizeDBPart(part: string): string {
  return part
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');
}
