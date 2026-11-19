import { createId } from '@paralleldrive/cuid2';
import { createDB } from '@vers/db';
import { removeTestDatabase } from '@vers/db/test-support';
import postgres from 'postgres';
import { z } from 'zod';
import { cloneDatabaseFromTemplate } from '../clone-database-from-template';
import { registerWorkerClone } from '../register-worker-clone';
import type { TestDBHandle } from '../test-db-handle';

export async function createSchemaTestDB(): Promise<TestDBHandle> {
  const host = await resolveHost();

  const cloneSchema = `tu_${createId()}`;

  try {
    // one multi-statement query is one round trip for the whole clone, and Postgres runs it in a
    // single implicit transaction, so a failed clone leaves no half-built schema behind
    const blueprint = await host.blueprint;

    await host.sql.unsafe(buildCloneScript(blueprint, cloneSchema));
  } catch (error) {
    await removeCloneSchema(host.sql, cloneSchema);

    throw error;
  }

  const db = createDB({
    databaseURL: host.databaseURL,
    resumeDetection: false,
    searchPath: cloneSchema,
  });

  return {
    db,
    [Symbol.asyncDispose]: async () => {
      await db.destroy();

      await removeCloneSchema(host.sql, cloneSchema);
    },
  };
}

const ForeignKeyRowSchema = z.object({
  columns: z.array(z.string()),
  conname: z.string(),
  condeferrable: z.boolean(),
  condeferred: z.boolean(),
  confdeltype: z.string(),
  confupdtype: z.string(),
  refColumns: z.array(z.string()),
  refTableName: z.string(),
  tableName: z.string(),
});

const TriggerRowSchema = z.object({ def: z.string(), tableName: z.string() });

interface SchemaBlueprint {
  readonly foreignKeys: ReadonlyArray<z.infer<typeof ForeignKeyRowSchema>>;
  readonly tables: ReadonlyArray<string>;
  readonly triggers: ReadonlyArray<z.infer<typeof TriggerRowSchema>>;
}

interface Host {
  // the public schema's shape, read once per host: every clone replays it
  readonly blueprint: Promise<SchemaBlueprint>;
  readonly databaseURL: string;
  readonly sql: postgres.Sql;
}

let host: Promise<Host> | undefined;

function resolveHost(): Promise<Host> {
  host ??= createHost();

  return host;
}

async function createHost(): Promise<Host> {
  const databaseURL = await cloneDatabaseFromTemplate();

  const sql = postgres(databaseURL, { onnotice: () => {} });

  registerWorkerClone(async () => {
    host = undefined;

    await sql.end();

    await removeTestDatabase(databaseURL);
  });

  return { blueprint: readSchemaBlueprint(sql), databaseURL, sql };
}

async function readSchemaBlueprint(sql: postgres.Sql): Promise<SchemaBlueprint> {
  const [tables, foreignKeys, triggers] = await Promise.all([
    readTables(sql),
    readForeignKeys(sql),
    readTriggers(sql),
  ]);

  return { foreignKeys, tables, triggers };
}

async function readTables(sql: postgres.Sql): Promise<ReadonlyArray<string>> {
  const tableRows = await sql`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;

  return z
    .array(z.object({ tablename: z.string() }))
    .parse(tableRows)
    .map((table) => table.tablename);
}

// `LIKE ... INCLUDING ALL` never copies foreign keys, so they are rebuilt from `pg_constraint`
async function readForeignKeys(
  sql: postgres.Sql,
): Promise<Array<z.infer<typeof ForeignKeyRowSchema>>> {
  const foreignKeyRows = await sql`
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

  return z.array(ForeignKeyRowSchema).parse(foreignKeyRows);
}

async function readTriggers(sql: postgres.Sql): Promise<Array<z.infer<typeof TriggerRowSchema>>> {
  const triggerRows = await sql`
    SELECT c.relname AS "tableName", pg_get_triggerdef(t.oid) AS def
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal
  `;

  return z.array(TriggerRowSchema).parse(triggerRows);
}

const FOREIGN_KEY_ACTIONS: ReadonlyMap<string, string> = new Map([
  ['a', 'NO ACTION'],
  ['c', 'CASCADE'],
  ['d', 'SET DEFAULT'],
  ['n', 'SET NULL'],
  ['r', 'RESTRICT'],
]);

function buildCloneScript(blueprint: SchemaBlueprint, cloneSchema: string): string {
  const schema = quoteIdentifier(cloneSchema);

  const tables = blueprint.tables.map(
    (table) =>
      `CREATE TABLE ${schema}.${quoteIdentifier(table)} (LIKE public.${quoteIdentifier(table)} INCLUDING ALL)`,
  );

  const foreignKeys = blueprint.foreignKeys.map((fk) => {
    const deferrable = fk.condeferrable
      ? `DEFERRABLE${fk.condeferred ? ' INITIALLY DEFERRED' : ''}`
      : '';

    return [
      `ALTER TABLE ${schema}.${quoteIdentifier(fk.tableName)}`,
      `ADD CONSTRAINT ${quoteIdentifier(fk.conname)}`,
      `FOREIGN KEY (${fk.columns.map(quoteIdentifier).join(', ')})`,
      `REFERENCES ${schema}.${quoteIdentifier(fk.refTableName)} (${fk.refColumns.map(quoteIdentifier).join(', ')})`,
      `ON UPDATE ${FOREIGN_KEY_ACTIONS.get(fk.confupdtype) ?? 'NO ACTION'}`,
      `ON DELETE ${FOREIGN_KEY_ACTIONS.get(fk.confdeltype) ?? 'NO ACTION'}`,
      deferrable,
    ].join(' ');
  });

  // only the `ON <table>` target is repointed: the trigger function resolves against `public` at
  // creation time and is stateless, so every clone shares it
  const triggers = blueprint.triggers.map((trigger) =>
    trigger.def.replace(
      new RegExp(` ON (public\\.)?"?${trigger.tableName}"? `, 'u'),
      ` ON ${schema}.${quoteIdentifier(trigger.tableName)} `,
    ),
  );

  return [`CREATE SCHEMA ${schema}`, ...tables, ...foreignKeys, ...triggers].join(';\n');
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function removeCloneSchema(sql: postgres.Sql, cloneSchema: string): Promise<void> {
  await sql`DROP SCHEMA IF EXISTS ${sql(cloneSchema)} CASCADE`;
}
