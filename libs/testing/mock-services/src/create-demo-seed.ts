import { createId } from '@paralleldrive/cuid2';
import { avatarCollection } from './db/avatar-collection';
import { userCollection } from './db/user-collection';

/**
 * The e2e game-flow accounts' logins. Each signed-in spec logs in as its own account so their
 * sessions never collide across a shared dev server.
 */
const GAME_DEMO_EMAIL = 'e2e-game@vers.test';
const GAME_DEMO_PASSWORD = 'password123';
const CANVAS_DEMO_EMAIL = 'e2e-canvas@vers.test';
const CANVAS_DEMO_PASSWORD = 'password123';
const AVATAR_SATELLITE_DEMO_EMAIL = 'e2e-avatar-satellite@vers.test';
const AVATAR_SATELLITE_DEMO_PASSWORD = 'password123';

/**
 * Seeds the demo accounts with no pre-existing session: every signed-in spec establishes its own
 * session through a real login round trip. Each game-flow account carries one avatar so the
 * shell's active-avatar gate admits it straight to the game rather than the roster.
 */
export async function createDemoSeed(): Promise<void> {
  const demoUserID = createId();
  const gameDemoUserID = createId();
  const canvasDemoUserID = createId();
  const avatarSatelliteDemoUserID = createId();

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

  await userCollection.create({
    createdAt: new Date(),
    email: GAME_DEMO_EMAIL,
    id: gameDemoUserID,
    name: 'Game Demo Account',
    password: GAME_DEMO_PASSWORD,
    seed: 0,
    updatedAt: new Date(),
    username: 'e2e-game',
  });

  await userCollection.create({
    createdAt: new Date(),
    email: CANVAS_DEMO_EMAIL,
    id: canvasDemoUserID,
    name: 'Canvas Demo Account',
    password: CANVAS_DEMO_PASSWORD,
    seed: 0,
    updatedAt: new Date(),
    username: 'e2e-canvas',
  });

  await userCollection.create({
    createdAt: new Date(),
    email: AVATAR_SATELLITE_DEMO_EMAIL,
    id: avatarSatelliteDemoUserID,
    name: 'Avatar Satellite Demo Account',
    password: AVATAR_SATELLITE_DEMO_PASSWORD,
    seed: 0,
    updatedAt: new Date(),
    username: 'e2e-avatar-satellite',
  });

  await createDemoAvatar(demoUserID, 'Demo Test Avatar');
  await createDemoAvatar(gameDemoUserID, 'Game Test Avatar');
  await createDemoAvatar(canvasDemoUserID, 'Canvas Test Avatar');
  await createDemoAvatar(avatarSatelliteDemoUserID, 'Satellite Test Avatar');
}

async function createDemoAvatar(userID: string, name: string): Promise<void> {
  await avatarCollection.create({
    createdAt: new Date(),
    id: createId(),
    name,
    updatedAt: new Date(),
    userID,
  });
}
