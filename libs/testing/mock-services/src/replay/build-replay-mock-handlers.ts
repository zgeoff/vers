import { buildMockService } from '@vers/client-test-utils/orpc';
import { replayContract } from '@vers/contract-replay';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { replayRouter } from './replay-router';

export function buildReplayMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: replayContract,
    resolveContext: resolveSessionContext,
    router: replayRouter,
  });
}
