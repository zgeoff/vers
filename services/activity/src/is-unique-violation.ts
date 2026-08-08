/**
 * postgres.js reports a unique-constraint violation as SQLSTATE 23505.
 */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
