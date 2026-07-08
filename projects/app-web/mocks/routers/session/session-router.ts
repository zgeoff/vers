import { createSession } from './create-session';
import { deleteSession } from './delete-session';
import { getSession } from './get-session';
import { getSessions } from './get-sessions';
import { refreshTokens } from './refresh-tokens';
import { stepUpRouter } from './step-up/step-up-router';
import { verifySession } from './verify-session';

export const sessionRouter = {
  createSession,
  deleteSession,
  getSession,
  getSessions,
  refreshTokens,
  stepUp: stepUpRouter,
  verifySession,
};
