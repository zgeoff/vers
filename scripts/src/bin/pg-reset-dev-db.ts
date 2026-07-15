import { applyMigrations } from '@vers/db';
import { oraPromise } from 'ora';
import { env } from '../postgres/env';
import { pg } from '../postgres/pg';

async function resetDevDB() {
  const query = `
    -- Suppress NOTICE messages
    SET client_min_messages TO WARNING;

    -- Disable foreign key checks temporarily
    SET session_replication_role = 'replica';

    -- Drop all schemas except public (and system schemas)
    DO $$ DECLARE
        r RECORD;
    BEGIN
        FOR r IN (
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name NOT IN ('public', 'information_schema', 'pg_catalog', 'pg_toast')
        ) LOOP
            EXECUTE 'DROP SCHEMA IF EXISTS ' || quote_ident(r.schema_name) || ' CASCADE';
        END LOOP;
    END $$;

    -- Clean up public schema
    DO $$ DECLARE
        r RECORD;
    BEGIN
        -- Drop all tables
        FOR r IN (
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
        ) LOOP
            EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
        END LOOP;

        -- Drop all views
        FOR r IN (
            SELECT viewname
            FROM pg_views
            WHERE schemaname = 'public'
        ) LOOP
            EXECUTE 'DROP VIEW IF EXISTS public.' || quote_ident(r.viewname) || ' CASCADE';
        END LOOP;

        -- Drop all types (including enums)
        FOR r IN (
            SELECT typname
            FROM pg_type t
            JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE n.nspname = 'public'
            AND t.typtype = 'e'
        ) LOOP
            EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
        END LOOP;

        -- Drop all functions
        FOR r IN (
            SELECT proname, oidvectortypes(proargtypes) as args
            FROM pg_proc
            INNER JOIN pg_namespace ns ON (pg_proc.pronamespace = ns.oid)
            WHERE ns.nspname = 'public'
        ) LOOP
            EXECUTE 'DROP FUNCTION IF EXISTS public.' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
        END LOOP;
    END $$;

    -- Re-enable foreign key checks
    SET session_replication_role = 'origin';
  `;

  const cleanupStart = Date.now();

  const cleanupSpinnerConfig = {
    failText: () => `Database cleanup failed in ${Date.now() - cleanupStart}ms`,
    successText: () => `Database cleanup completed in ${Date.now() - cleanupStart}ms`,
    text: 'Cleaning up database...',
  };

  await oraPromise(pg.unsafe(query), cleanupSpinnerConfig);

  const kyselyMigrationStart = Date.now();

  const kyselyMigrationSpinnerConfig = {
    failText: () => `Kysely migration failed in ${Date.now() - kyselyMigrationStart}ms`,
    successText: () => `Kysely migration completed in ${Date.now() - kyselyMigrationStart}ms`,
    text: 'Applying kysely migrations...',
  };

  const migrationResult = await oraPromise(
    applyMigrations({ databaseURL: env.DATABASE_URL }),
    kyselyMigrationSpinnerConfig,
  );

  if (migrationResult.error !== undefined) {
    throw migrationResult.error instanceof Error
      ? migrationResult.error
      : new Error('kysely migration failed', { cause: migrationResult.error });
  }

  process.exit(0);
}

try {
  await resetDevDB();
} catch (error) {
  console.error('❌ Reset failed');
  console.error(error);
  process.exit(1);
}
