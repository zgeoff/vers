import type { DB } from '@vers/db';
import type { Kysely } from 'kysely';
import type { RestoreDrillCheck } from './types';

export async function readSessionChecks(db: Kysely<DB>): Promise<ReadonlyArray<RestoreDrillCheck>> {
  const [usersWithSeveralVerifiedSessions, verifiedSessionsWithoutRefreshToken] = await Promise.all(
    [
      db
        .selectFrom('sessions')
        .select('userId')
        .where('verified', '=', true)
        .groupBy('userId')
        .having((eb) => eb.fn.countAll(), '>', 1)
        .orderBy('userId')
        .execute(),
      db
        .selectFrom('sessions')
        .select('id')
        .where('verified', '=', true)
        .where('refreshToken', 'is', null)
        .orderBy('id')
        .execute(),
    ],
  );

  return [
    {
      area: 'sessions',
      name: 'one verified session per user',
      violations: usersWithSeveralVerifiedSessions.map((row) => `user ${row.userId}`),
    },
    {
      area: 'sessions',
      name: 'a verified session holds a refresh token',
      violations: verifiedSessionsWithoutRefreshToken.map((row) => `session ${row.id}`),
    },
  ];
}
