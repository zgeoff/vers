import { buildMockService } from '@vers/client-test-utils/orpc';
import { userContract } from '@vers/contract-user';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { userRouter } from './user-router';

/**
 * Builds the MSW handlers backing the user contract's stateful mock backend at the given origin.
 */
export function buildUserMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: userContract,
    resolveContext: resolveSessionContext,
    router: userRouter,
  });
}
