import { factory, primaryKey } from '@mswjs/data';
import { createId } from '@paralleldrive/cuid2';
import { Class } from '@vers/data';
import { encodeMockJWT } from './utils/encode-mock-jwt';

const EXPIRATION_IN_MS = 1000 * 60 * 60 * 24; // 1 day

export const db = factory({
  avatar: {
    class: () => Class.Brute as (typeof Class)[keyof typeof Class],
    createdAt: () => new Date().toISOString(),
    id: primaryKey(() => createId()),
    level: () => 1,
    name: String,
    userID: String,
    xp: () => 0,
  },
  session: {
    createdAt: () => new Date().toISOString(),
    expiresAt: () => new Date(Date.now() + EXPIRATION_IN_MS).toISOString(),
    id: primaryKey(() => createId()),
    refreshToken: () =>
      encodeMockJWT({
        exp: Date.now() + EXPIRATION_IN_MS,
        sub: createId(),
      }),
    userID: () => createId(),
    verified: Boolean,
  },
  user: {
    createdAt: () => new Date().toISOString(),
    email: () => 'user@test.com',
    id: primaryKey(() => createId()),
    name: () => 'John Smith',
    password: () => 'password',
    updatedAt: () => new Date().toISOString(),
    username: () => 'test_user',
  },
  verification: {
    createdAt: () => new Date().toISOString(),
    id: primaryKey(() => createId()),
    target: () => 'user@test.com',
    type: () => '2fa',
  },
});
