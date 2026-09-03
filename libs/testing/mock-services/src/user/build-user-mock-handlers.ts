import { buildMockService } from '@vers/client-test-utils/orpc';
import { userContract } from '@vers/contract-user';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { userRouter } from './user-router';

export function buildUserMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: userContract,
    resolveContext: resolveSessionContext,
    router: userRouter,
  });
}
