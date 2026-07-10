import { buildMockService } from '@vers/client-test-utils/orpc';
import { avatarContract } from '@vers/contract-avatar';
import { sessionContract } from '@vers/contract-session';
import { userContract } from '@vers/contract-user';
import { verificationContract } from '@vers/contract-verification';
import type { HttpHandler } from 'msw';
import { SERVICE_URLS } from '../lib/rpc/service-urls';
import { createDemoSeed } from './db/create-demo-seed';
import { resolveSessionContext } from './resolve-session-context';
import { avatarRouter } from './routers/avatar/avatar-router';
import { sessionRouter } from './routers/session/session-router';
import { userRouter } from './routers/user/user-router';
import { verificationRouter } from './routers/verification/verification-router';

await createDemoSeed();

export const handlers: Array<HttpHandler> = [
  ...buildMockService({
    baseUrl: SERVICE_URLS.user,
    contract: userContract,
    resolveContext: resolveSessionContext,
    router: userRouter,
  }),
  ...buildMockService({
    baseUrl: SERVICE_URLS.session,
    contract: sessionContract,
    resolveContext: resolveSessionContext,
    router: sessionRouter,
  }),
  ...buildMockService({
    baseUrl: SERVICE_URLS.verification,
    contract: verificationContract,
    resolveContext: resolveSessionContext,
    router: verificationRouter,
  }),
  ...buildMockService({
    baseUrl: SERVICE_URLS.avatar,
    contract: avatarContract,
    resolveContext: resolveSessionContext,
    router: avatarRouter,
  }),
];
