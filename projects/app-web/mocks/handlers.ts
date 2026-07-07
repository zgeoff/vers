import { buildMockService } from '@vers/client-test-utils/rpc-msw';
import { avatarContract } from '@vers/contract-avatar';
import { sessionContract } from '@vers/contract-session';
import { userContract } from '@vers/contract-user';
import { verificationContract } from '@vers/contract-verification';
import type { HttpHandler } from 'msw';
import { SERVICE_URLS } from '../src/lib/rpc/service-urls';
import { createDemoSeed } from './db/seed';
import { resolveSessionContext } from './resolve-session-context';
import { buildMockAvatarRouter } from './routers/avatar-router';
import { buildMockSessionRouter } from './routers/session-router';
import { buildMockUserRouter } from './routers/user-router';
import { buildMockVerificationRouter } from './routers/verification-router';

await createDemoSeed();

export const handlers: Array<HttpHandler> = [
  ...buildMockService({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: resolveSessionContext,
    router: buildMockUserRouter(),
  }),
  ...buildMockService({
    baseUrl: SERVICE_URLS.session,
    contract: sessionContract,
    resolveContext: resolveSessionContext,
    router: buildMockSessionRouter(),
  }),
  ...buildMockService({
    baseUrl: SERVICE_URLS.verification,
    contract: verificationContract,
    resolveContext: resolveSessionContext,
    router: buildMockVerificationRouter(),
  }),
  ...buildMockService({
    baseUrl: SERVICE_URLS.avatar,
    contract: avatarContract,
    resolveContext: resolveSessionContext,
    router: buildMockAvatarRouter(),
  }),
];
