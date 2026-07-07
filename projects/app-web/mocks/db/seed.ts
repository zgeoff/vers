import { createId } from '@paralleldrive/cuid2';
import { sessionCollection } from './session-collection';
import { userCollection } from './user-collection';

/** The demo session id every mock-backed dev run can sign in with (`Authorization: Bearer <id>`). */
export const DEMO_SESSION_ID = 'dev-session';

/**
 * Seeds the demo signed-in identity every mock-backed dev/test run needs once: a user plus a live
 * session, so the auth-state-aware server render has a real "signed in" path to prove without a
 * login flow existing yet (that lands in phase 1).
 */
export async function createDemoSeed(): Promise<void> {
  const demoUserID = createId();

  await userCollection.create({
    createdAt: new Date(),
    email: 'demo@vers.test',
    id: demoUserID,
    name: 'Demo Account',
    seed: 0,
    updatedAt: new Date(),
    username: 'demo',
  });

  await sessionCollection.create({
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    id: DEMO_SESSION_ID,
    ipAddress: '127.0.0.1',
    updatedAt: new Date(),
    userID: demoUserID,
    verified: true,
  });
}
