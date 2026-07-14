import { buildMockService } from '@vers/client-test-utils/orpc';
import { keysContract } from '@vers/contract-keys';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { keysRouter } from './keys-router';

/**
 * Builds the MSW handlers backing the keys contract's mock backend at the given origin.
 */
export function buildKeysMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: keysContract,
    resolveContext: resolveSessionContext,
    router: keysRouter,
  });
}
