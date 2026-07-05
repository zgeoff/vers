// PostgresError hangs off the default export — the ESM entry has no named exports
import postgres from 'postgres';

export function isPGError(error: unknown): error is postgres.PostgresError {
  return error instanceof postgres.PostgresError;
}
