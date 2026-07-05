import { createId } from '@paralleldrive/cuid2';
import { db } from '../mocks/db';
import { createJWT } from './create-jwt';

interface UserParts {
  email?: string;
  id?: string;
  is2FAEnabled?: boolean;
  name?: string;
  password?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export async function createAuthedUser(userParts: UserParts, sessionID?: string) {
  // an empty comparator matches any user, so only look up when an id is given
  const existingUser =
    userParts.id === undefined
      ? undefined
      : db.user.findFirst({ where: { id: { equals: userParts.id } } });

  const user = existingUser ?? db.user.create({ ...userParts });

  const accessToken = await createJWT({
    audience: 'test.com',
    issuer: 'http://test.com/',
    sub: user.id,
  });

  const refreshToken = await createJWT({
    audience: 'test.com',
    expirationTime: '1d',
    issuer: 'http://test.com/',
    sub: user.id,
  });

  const session = db.session.create({
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    id: sessionID ?? createId(),
    refreshToken,
    userID: user.id,
  });

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (userParts.is2FAEnabled) {
    db.verification.create({
      target: user.email,
      type: '2fa',
    });
  }

  return { accessToken, refreshToken, session, user };
}
