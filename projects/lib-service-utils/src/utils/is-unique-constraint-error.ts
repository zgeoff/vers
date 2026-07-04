import postgres from 'postgres';

export function isUniqueConstraintError(
  error: postgres.PostgresError,
  constraintName: string,
) {
  return error.code === '23505' && error.constraint_name === constraintName;
}
