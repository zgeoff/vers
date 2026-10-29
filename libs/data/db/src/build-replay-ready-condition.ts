import type { Expression, ExpressionBuilder, SqlBool } from 'kysely';
import { buildUnsettledAncestorQuery } from './build-unsettled-ancestor-query';
import type { DB } from './schema.generated';

export function buildReplayReadyCondition(
  eb: ExpressionBuilder<DB, 'activities'>,
): Expression<SqlBool> {
  const hasUnsettledAncestor = eb.exists(buildUnsettledAncestorQuery());

  return eb.and([
    eb('activities.appendedHead', '>', eb.ref('activities.verifiedHead')),
    eb('activities.status', '!=', 'rejected'),
    eb.not(hasUnsettledAncestor),
  ]);
}
