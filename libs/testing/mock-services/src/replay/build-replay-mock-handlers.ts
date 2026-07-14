import { buildMockService } from '@vers/client-test-utils/orpc';
import { replayContract } from '@vers/contract-replay';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { replayRouter } from './replay-router';

/**
 * Builds the MSW handlers backing the replay contract's canned mock backend at the given origin.
 */
export function buildReplayMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: replayContract,
    resolveContext: resolveSessionContext,
    router: replayRouter,
  });
}
