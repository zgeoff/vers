import type postgres from 'postgres';

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function isUniqueConstraintError(error: postgres.PostgresError, constraintName: string) {
  return error.code === '23505' && error.constraint_name === constraintName;
}
