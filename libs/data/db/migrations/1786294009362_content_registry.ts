import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import { contentDocumentV1 } from '../src/content-seed/content-document-v1';
import { contentDocumentV2 } from '../src/content-seed/content-document-v2';

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('content_versions')
    .addColumn('content_version', 'text', (col) => col.primaryKey())
    .addColumn('document', 'jsonb', (col) => col.notNull())
    .addColumn('published_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('content_current')
    .addColumn('singleton', 'boolean', (col) =>
      col
        .primaryKey()
        .defaultTo(true)
        .check(sql`singleton`),
    )
    .addColumn('content_version', 'text', (col) =>
      col.notNull().references('content_versions.content_version'),
    )
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await sql`
    CREATE FUNCTION content_versions_immutable() RETURNS trigger AS $$
    BEGIN
      RAISE EXCEPTION 'content_versions rows are immutable';
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  await sql`
    CREATE TRIGGER content_versions_immutable
    BEFORE UPDATE OR DELETE ON content_versions
    FOR EACH ROW
    EXECUTE FUNCTION content_versions_immutable()
  `.execute(db);

  await sql`
    INSERT INTO content_versions (content_version, document)
    VALUES (${contentDocumentV1.contentVersion}, ${contentDocumentV1}::jsonb)
  `.execute(db);

  await sql`
    INSERT INTO content_versions (content_version, document)
    VALUES (${contentDocumentV2.contentVersion}, ${contentDocumentV2}::jsonb)
  `.execute(db);

  await sql`
    INSERT INTO content_current (content_version) VALUES (${contentDocumentV2.contentVersion})
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('content_current').execute();
  await sql`DROP TRIGGER IF EXISTS content_versions_immutable ON content_versions`.execute(db);
  await sql`DROP FUNCTION IF EXISTS content_versions_immutable()`.execute(db);
  await db.schema.dropTable('content_versions').execute();
}
