import type { RawBuilder } from 'kysely';
import { sql } from 'kysely';

// The walk stops at an ancestor the verifier proved part of, since that one was claimed only once
// everything before it settled; UNION rather than UNION ALL ends it on a cycle of declared
// predecessors, which nothing on the request path refuses.
export function buildUnsettledAncestorQuery(): RawBuilder<unknown> {
  const isSettled = sql`(ancestor.status = 'rejected' or (ancestor.verified_head >= ancestor.appended_head and ancestor.status not in ('parked', 'quarantined')))`;

  return sql`(
    with recursive walk(ancestor_id) as (
      select activities.predecessor_activity_id
      union
      select ancestor.predecessor_activity_id
      from walk
      join activities as ancestor
        on ancestor.id = walk.ancestor_id and ancestor.avatar_id = activities.avatar_id
      where ancestor.verified_head = 0 and ${isSettled}
    )
    select 1
    from walk
    left join activities as ancestor
      on ancestor.id = walk.ancestor_id and ancestor.avatar_id = activities.avatar_id
    where walk.ancestor_id is not null and (ancestor.id is null or not ${isSettled})
  )`;
}
