import { createId } from '@paralleldrive/cuid2';
import { userCollection } from './user-collection';

/**
 * The e2e game-flow accounts' logins. Each signed-in spec logs in as its own account so their
 * sessions never collide across a shared dev server.
 */
const GAME_DEMO_EMAIL = 'e2e-game@vers.test';
const GAME_DEMO_PASSWORD = 'password123';
const CANVAS_DEMO_EMAIL = 'e2e-canvas@vers.test';
const CANVAS_DEMO_PASSWORD = 'password123';

/**
 * Seeds the demo accounts with no pre-existing session: every signed-in spec establishes its own
 * session through a real login round trip.
 */
export async function createDemoSeed(): Promise<void> {
  await userCollection.create({
    createdAt: new Date(),
    email: 'demo@vers.test',
    id: createId(),
    name: 'Demo Account',
    password: 'password123',
    seed: 0,
    updatedAt: new Date(),
    username: 'demo',
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

  await userCollection.create({
    createdAt: new Date(),
    email: CANVAS_DEMO_EMAIL,
    id: createId(),
    name: 'Canvas Demo Account',
    password: CANVAS_DEMO_PASSWORD,
    seed: 0,
    updatedAt: new Date(),
    username: 'e2e-canvas',
  });
}
