import { buildMockService } from '@vers/client-test-utils/orpc';
import { sessionContract } from '@vers/contract-session';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { sessionRouter } from './session-router';

/**
 * Builds the MSW handlers backing the session contract's stateful mock backend at the given origin.
 */
export function buildSessionMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: sessionContract,
    resolveContext: resolveSessionContext,
    router: sessionRouter,
  });
}
