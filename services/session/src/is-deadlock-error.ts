export function isDeadlockError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '40P01';
}
