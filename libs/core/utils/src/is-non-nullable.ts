/**
 * Checks if a value is non-nullable.
 *
 * @param value - The value to check.
 * @returns `true` if the value is non-nullable, `false` otherwise.
 */
export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}
