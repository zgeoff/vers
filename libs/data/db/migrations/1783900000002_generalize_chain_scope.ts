import type { Kysely } from 'kysely';

/**
 * Generalizes the seed chain's key from `(avatar, node)` to `(avatar, chain scope)`, a
 * `(scope_type, scope_id)` pair identifying a stable, returnable target; `world_map_node` is the
 * scope for world-map nodes.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activity_chains').renameColumn('node_id', 'scope_id').execute();

  await db.schema
    .alterTable('activity_chains')
    .addColumn('scope_type', 'text', (col) => col.notNull().defaultTo('world_map_node'))
    .execute();

  await db.schema
    .alterTable('activity_chains')
    .alterColumn('scope_type', (col) => col.dropDefault())
    .execute();

  await db.schema.alterTable('activity_chains').dropConstraint('activity_chains_pk').execute();

  await db.schema
    .alterTable('activity_chains')
    .addPrimaryKeyConstraint('activity_chains_pk', ['avatar_id', 'scope_type', 'scope_id'])
    .execute();

  await db.schema.alterTable('activities').renameColumn('node_id', 'scope_id').execute();

  await db.schema
    .alterTable('activities')
    .addColumn('scope_type', 'text', (col) => col.notNull().defaultTo('world_map_node'))
    .execute();

  await db.schema
    .alterTable('activities')
    .alterColumn('scope_type', (col) => col.dropDefault())
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('activities').dropColumn('scope_type').execute();
  await db.schema.alterTable('activities').renameColumn('scope_id', 'node_id').execute();
  await db.schema.alterTable('activity_chains').dropConstraint('activity_chains_pk').execute();
  await db.schema.alterTable('activity_chains').renameColumn('scope_id', 'node_id').execute();

  await db.schema
    .alterTable('activity_chains')
    .addPrimaryKeyConstraint('activity_chains_pk', ['avatar_id', 'node_id'])
    .execute();

  await db.schema.alterTable('activity_chains').dropColumn('scope_type').execute();
}
