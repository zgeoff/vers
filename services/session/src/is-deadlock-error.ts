/**
 * Postgres reports a deadlock as SQLSTATE 40P01, which the driver relays as the error's `code`.
 */
export function isDeadlockError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '40P01';
}
