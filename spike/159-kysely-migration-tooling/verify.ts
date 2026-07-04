import { CamelCasePlugin, Kysely } from 'kysely';
import { PostgresJSDialect } from 'kysely-postgres-js';
import postgres from 'postgres';

import type { DB } from './src/schema.generated';

/**
 * End-to-end proof: the kysely-codegen types + CamelCasePlugin round-trip
 * against the migrated schema — typed insert, typed select, defaults applied,
 * seed row present.
 */
const db = new Kysely<DB>({
  dialect: new PostgresJSDialect({
    postgres: postgres(
      process.env.DATABASE_URL ?? 'postgres://spike:spike@localhost:55432/postgres',
      { max: 1 },
    ),
  }),
  plugins: [new CamelCasePlugin()],
});

const inserted = await db
  .insertInto('users')
  .values({
    email: 'verify@vers.local',
    id: 'usr_verify',
    name: 'Verify User',
    passwordHash: 'not-a-real-hash',
    username: 'verify',
  })
  .returningAll()
  .executeTakeFirstOrThrow();

console.log('inserted:', {
  createdAt: inserted.createdAt instanceof Date,
  id: inserted.id,
  seedDefault: inserted.seed,
});

const devUser = await db
  .selectFrom('users')
  .select(['id', 'seed', 'passwordHash'])
  .where('username', '=', 'dev')
  .executeTakeFirstOrThrow();

console.log('seeded dev user:', devUser);

if (inserted.seed !== 0) throw new Error('seed column default should be 0');
if (devUser.seed !== 1337) throw new Error('seeded user should carry seed 1337');

await db.destroy();
console.log('VERIFY OK');
