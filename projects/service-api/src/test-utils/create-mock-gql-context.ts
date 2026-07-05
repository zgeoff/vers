import { createId } from '@paralleldrive/cuid2';
import type { ServiceRouter as AvatarServiceRouter } from '@vers/service-avatar';
import type { ServiceRouter as EmailServiceRouter } from '@vers/service-email';
import type { ServiceRouter as SessionServiceRouter } from '@vers/service-session';
import { ServiceID } from '@vers/service-types';
import type { ServiceRouter as UserServiceRouter } from '@vers/service-user';
import type { ServiceRouter as VerificationServiceRouter } from '@vers/service-verification';
import { db } from '~/mocks/db';
import { env } from '../env';
import type { AuthedContext, Context } from '../types';
import { createTRPCClient } from '../utils/create-trpc-client';

interface MockContextConfig {
  accessToken?: string;
  ipAddress?: string;
  requestID?: string;
  session?: AuthedContext['session'];
  user?: AuthedContext['user'];
}

export function createMockGQLContext(config: MockContextConfig): Context {
  const request = new Request('https://test.com/');

  if (config.accessToken) {
    request.headers.set('authorization', `Bearer ${config.accessToken}`);
  }

  const requestID = config.requestID ?? createId();

  const ipAddress = config.session?.ipAddress ?? config.ipAddress ?? '127.0.0.1';

  const avatar = createTRPCClient<AvatarServiceRouter>({
    ...(config.accessToken !== undefined && {
      accessToken: config.accessToken,
    }),
    apiURL: env.AVATARS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceAvatar,
  });

  const email = createTRPCClient<EmailServiceRouter>({
    ...(config.accessToken !== undefined && {
      accessToken: config.accessToken,
    }),
    apiURL: env.EMAILS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceEmail,
  });

  const user = createTRPCClient<UserServiceRouter>({
    ...(config.accessToken !== undefined && {
      accessToken: config.accessToken,
    }),
    apiURL: env.USERS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceUser,
  });

  const session = createTRPCClient<SessionServiceRouter>({
    ...(config.accessToken !== undefined && {
      accessToken: config.accessToken,
    }),
    apiURL: env.SESSIONS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceSession,
  });

  const verification = createTRPCClient<VerificationServiceRouter>({
    ...(config.accessToken !== undefined && {
      accessToken: config.accessToken,
    }),
    apiURL: env.VERIFICATIONS_SERVICE_URL,
    requestID,
    serviceID: ServiceID.ServiceVerification,
  });

  const sharedContext = {
    ipAddress,
    request,
    requestID,
    services: {
      avatar,
      email,
      session,
      user,
      verification,
    },
  };

  if (!config.user && !config.session) {
    return {
      ...sharedContext,
      session: null,
      user: null,
    };
  }

  const authedUser = config.user ?? db.user.create({ email: 'test@example.com' });

  const authedSession = config.session ?? db.session.create({ userID: authedUser.id });

  if (!config.user) {
    return {
      ...sharedContext,
      session: authedSession,
      user: null,
    };
  }

  return {
    ...sharedContext,
    session: authedSession,
    user: authedUser,
  };
}
