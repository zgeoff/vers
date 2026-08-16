/**
 * True when the error is the activities predecessor self-FK violation. postgres.js raises it as
 * SQLSTATE 23503, naming the constraint.
 */
export function isPredecessorForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23503' &&
    'constraint_name' in error &&
    (error as { constraint_name: unknown }).constraint_name ===
      'activities_predecessor_activity_id_activities_id_fk'
  );
}
