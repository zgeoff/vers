import { createId } from '@paralleldrive/cuid2';
import { sessionCollection } from './session-collection';
import { userCollection } from './user-collection';

/** The demo session id every mock-backed dev run can sign in with (`Authorization: Bearer <id>`). */
export const DEMO_SESSION_ID = 'dev-session';

/**
 * The e2e game-flow account's own login, so its real sign-in never hits the force-logout
 * confirmation that `DEMO_SESSION_ID`'s live session would trigger.
 */
export const GAME_DEMO_EMAIL = 'e2e-game@vers.test';
export const GAME_DEMO_PASSWORD = 'password123';

/**
 * Seeds the demo signed-in identity: a user plus a live session, giving the auth-state-aware
 * server render a real "signed in" path to prove without a login flow existing yet. Also seeds a
 * second account with no pre-existing session, for e2e specs that need a real login round trip —
 * signing in as the first account instead would hit the force-logout confirmation, since it
 * already has a live session.
 */
export async function createDemoSeed(): Promise<void> {
  const demoUserID = createId();

  await userCollection.create({
    createdAt: new Date(),
    email: 'demo@vers.test',
    id: demoUserID,
    name: 'Demo Account',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'demo',
  });

  await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    id: DEMO_SESSION_ID,
    ipAddress: '127.0.0.1',
    previousRefreshToken: null,
    refreshToken: DEMO_SESSION_ID,
    updatedAt: new Date(),
    userID: demoUserID,
    verified: true,
  });

  await userCollection.create({
    createdAt: new Date(),
    email: GAME_DEMO_EMAIL,
    id: createId(),
    name: 'Game Demo Account',
    password: GAME_DEMO_PASSWORD,
    seed: 0,
    updatedAt: new Date(),
    username: 'e2e-game',
  });
}
