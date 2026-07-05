import type { ServiceRouter as AvatarServiceRouter } from '@vers/service-avatar';
import type { ServiceRouter as EmailServiceRouter } from '@vers/service-email';
import type { ServiceRouter as SessionServiceRouter } from '@vers/service-session';
import { ServiceID } from '@vers/service-types';
import type { ServiceRouter as UserServiceRouter } from '@vers/service-user';
import { getTokenFromHeader } from '@vers/service-utils';
import type { ServiceRouter as VerificationServiceRouter } from '@vers/service-verification';
import type { YogaInitialContext } from 'graphql-yoga';
import type { Context as HonoContext } from 'hono';
import { env } from './env';
import type { AuthedContext, Context, UnverifiedAuthContext } from './types';
import { createTRPCClient } from './utils/create-trpc-client';

export async function createYogaContext(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  yogaCtx: YogaInitialContext,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  honoCtx: HonoContext,
): Promise<Context> {
  const requestID = honoCtx.get('requestId');
  const authHeader = yogaCtx.request.headers.get('authorization');
  const accessToken = getTokenFromHeader(authHeader);

  const avatar = createTRPCClient<AvatarServiceRouter>({
    accessToken,
    apiURL: env.AVATARS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceAvatar,
  });

  const email = createTRPCClient<EmailServiceRouter>({
    accessToken,
    apiURL: env.EMAILS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceEmail,
  });

  const user = createTRPCClient<UserServiceRouter>({
    accessToken,
    apiURL: env.USERS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceUser,
  });

  const session = createTRPCClient<SessionServiceRouter>({
    accessToken,
    apiURL: env.SESSIONS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceSession,
  });

  const verification = createTRPCClient<VerificationServiceRouter>({
    accessToken,
    apiURL: env.VERIFICATIONS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceVerification,
  });

  const userID = honoCtx.get('userID');
  const sessionID = honoCtx.get('sessionID');

  const sharedContext = {
    ipAddress: honoCtx.get('ipAddress'),
    request: yogaCtx.request,
    requestID,
    services: {
      avatar,
      email,
      session,
      user,
      verification,
    },
  };

  // if we're missing a user ID, attempt to return an unverified auth context
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (sessionID && !userID) {
    const activeSession = await session.getSession.query({ id: sessionID });

    if (!activeSession) {
      throw new Error('Invalid request');
    }

    const unverifiedAuthContext: UnverifiedAuthContext = {
      ...sharedContext,
      session: activeSession,
      user: null,
    };

    return unverifiedAuthContext;
  }

  // if we have both userID and sessionID, attempt to return an authed context
  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (sessionID && userID) {
    const activeSession = await session.getSession.query({ id: sessionID });
    const activeUser = await user.getUser.query({ id: userID });

    if (!activeUser || !activeSession) {
      throw new Error('Invalid request');
    }

    const authedContext: AuthedContext = {
      ...sharedContext,
      session: activeSession,
      user: activeUser,
    };

    return authedContext;
  }

  // if both userID or sessionID are missing, return an anonymous context
  return {
    ...sharedContext,
    session: null,
    user: null,
  };
}
