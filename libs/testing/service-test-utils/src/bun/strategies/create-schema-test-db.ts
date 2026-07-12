import { createId } from '@paralleldrive/cuid2';
import { createDB } from '@vers/db';
import postgres from 'postgres';
import { createDatabaseFromTemplate } from '../create-database-from-template';
import type { TestDBHandle } from '../test-db-handle';

/**
 * Schema isolation: a fresh clone of every `public` table (structure, indexes, foreign keys, and
 * `updated_at` triggers) in its own schema on a shared host database, with `search_path` scoped to
 * that schema alone. Writes are real, committed statements — unlike transaction isolation, a
 * caught constraint violation doesn't poison later queries on the same handle, and the handler's
 * own `db.transaction()` calls nest normally. Only code that runs entirely through the returned
 * `db` stays inside the boundary: a handler that opens its own connection, or that
 * schema-qualifies `public.<table>` directly, reaches the shared host state instead of the clone.
 * Database-scoped state (advisory locks, LISTEN/NOTIFY), DDL, and structures `LIKE` can't
 * reproduce (partitioned parents) still need `database` isolation.
 */
export async function createSchemaTestDB(): Promise<TestDBHandle> {
  const host = await getHost();

  const cloneSchema = `tu_${createId()}`;

  await host.sql`CREATE SCHEMA ${host.sql(cloneSchema)}`;

  try {
    await cloneTables(host.sql, cloneSchema);
    await cloneForeignKeys(host.sql, cloneSchema);
    await cloneTriggers(host.sql, cloneSchema);
  } catch (error) {
    await dropCloneSchema(host.sql, cloneSchema);

    throw error;
  }

  const db = createDB({ databaseURL: host.databaseURL, searchPath: cloneSchema });

  return {
    db,
    [Symbol.asyncDispose]: async () => {
      await db.destroy();

      await dropCloneSchema(host.sql, cloneSchema);
    },
  };
}

interface Host {
  readonly databaseURL: string;
  readonly sql: postgres.Sql;
}

let host: Promise<Host> | undefined;

/**
 * One template clone per test process, memoized independently of the sibling strategies' own
 * per-process databases: every schema-isolation acquire clones into this same host.
 */
function getHost(): Promise<Host> {
  host ??= buildHost();

  return host;
}

async function buildHost(): Promise<Host> {
  const databaseURL = await createDatabaseFromTemplate();

  return { databaseURL, sql: postgres(databaseURL, { onnotice: () => {} }) };
}

async function cloneTables(sql: postgres.Sql, cloneSchema: string): Promise<void> {
  const tables = await sql<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  for (const table of tables) {
    await sql`
      CREATE TABLE ${sql(cloneSchema)}.${sql(table.tablename)}
      (LIKE public.${sql(table.tablename)} INCLUDING ALL)
    `;
  }
}

interface ForeignKeyRow {
  readonly columns: ReadonlyArray<string>;
  readonly conname: string;
  readonly condeferrable: boolean;
  readonly condeferred: boolean;
  readonly confdeltype: string;
  readonly confupdtype: string;
  readonly refColumns: ReadonlyArray<string>;
  readonly refTableName: string;
  readonly tableName: string;
}

const FOREIGN_KEY_ACTIONS: Readonly<Record<string, string>> = {
  a: 'NO ACTION',
  c: 'CASCADE',
  d: 'SET DEFAULT',
  n: 'SET NULL',
  r: 'RESTRICT',
};

/**
 * `LIKE ... INCLUDING ALL` never copies foreign keys, so every public→public FK is rediscovered
 * from `pg_constraint` and rebuilt against the clone tables.
 */
async function cloneForeignKeys(sql: postgres.Sql, cloneSchema: string): Promise<void> {
  const foreignKeys = await sql<Array<ForeignKeyRow>>`
    SELECT
      con.conname,
      con.conrelid::regclass::text AS "tableName",
      con.confrelid::regclass::text AS "refTableName",
      con.confupdtype,
      con.confdeltype,
      con.condeferrable,
      con.condeferred,
      array_agg(att.attname ORDER BY k.ord) AS columns,
      array_agg(refatt.attname ORDER BY k.ord) AS "refColumns"
    FROM pg_constraint con
    CROSS JOIN LATERAL unnest(con.conkey, con.confkey) WITH ORDINALITY AS k(attnum, refattnum, ord)
    JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
    JOIN pg_attribute refatt ON refatt.attrelid = con.confrelid AND refatt.attnum = k.refattnum
    WHERE con.contype = 'f' AND con.connamespace = 'public'::regnamespace
    GROUP BY
      con.conname, con.conrelid, con.confrelid,
      con.confupdtype, con.confdeltype, con.condeferrable, con.condeferred
  `;

  for (const fk of foreignKeys) {
    const deferrable = fk.condeferrable
      ? `DEFERRABLE${fk.condeferred ? ' INITIALLY DEFERRED' : ''}`
      : '';

    await sql`
      ALTER TABLE ${sql(cloneSchema)}.${sql(fk.tableName)}
      ADD CONSTRAINT ${sql(fk.conname)}
      FOREIGN KEY (${sql(fk.columns)})
      REFERENCES ${sql(cloneSchema)}.${sql(fk.refTableName)} (${sql(fk.refColumns)})
      ON UPDATE ${sql.unsafe(FOREIGN_KEY_ACTIONS[fk.confupdtype] ?? 'NO ACTION')}
      ON DELETE ${sql.unsafe(FOREIGN_KEY_ACTIONS[fk.confdeltype] ?? 'NO ACTION')}
      ${sql.unsafe(deferrable)}
    `;
  }
}

interface TriggerRow {
  readonly def: string;
  readonly tableName: string;
}

/**
 * Trigger definitions are copied verbatim except for their `ON <table>` target, which is
 * repointed at the clone schema; the trigger function they call (`set_updated_at()`) resolves
 * against `public` at creation time and is stateless, so every clone safely shares it.
 */
async function cloneTriggers(sql: postgres.Sql, cloneSchema: string): Promise<void> {
  const triggers = await sql<Array<TriggerRow>>`
    SELECT c.relname AS "tableName", pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
  `;

  for (const trigger of triggers) {
    const rewritten = trigger.def.replace(
      new RegExp(` ON (public\\.)?"?${trigger.tableName}"? `),
      ` ON "${cloneSchema}"."${trigger.tableName}" `,
    );

    await sql.unsafe(rewritten);
  }
}

async function dropCloneSchema(sql: postgres.Sql, cloneSchema: string): Promise<void> {
  await sql`DROP SCHEMA IF EXISTS ${sql(cloneSchema)} CASCADE`;
}
