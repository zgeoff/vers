import type { Expression, ExpressionBuilder, SqlBool } from 'kysely';
import type { ACTIVITY_STATUS_TRANSITIONS } from './activity-status-transitions';
import type { ActivityStatus, DB } from './schema.generated';

// readonly throughout: a mutable recursive union would force every function that takes a row to
// opt out of readonly-parameter linting, and plain mutable values stay assignable
export type Json = JsonArray | JsonObject | JsonPrimitive;

type JsonArray = ReadonlyArray<Json>;

interface JsonObject {
  readonly [key: string]: Json | undefined;
}

type JsonPrimitive = boolean | number | string | null;

type ActivityStatusSource<To extends ActivityStatus> = {
  [From in ActivityStatus]: To extends (typeof ACTIVITY_STATUS_TRANSITIONS)[From][number]
    ? From
    : never;
}[ActivityStatus];

export interface ActivityStatusMove<To extends ActivityStatus> {
  readonly from: ReadonlyArray<ActivityStatusSource<To>>;
  readonly to: To;
}

export type ActivityRowFilter = (eb: ExpressionBuilder<DB, 'activities'>) => Expression<SqlBool>;

export type PoolResetReason = 'query_stall' | 'resume';
