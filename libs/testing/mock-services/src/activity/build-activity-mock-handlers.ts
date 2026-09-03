import { buildMockService } from '@vers/client-test-utils/orpc';
import { activityContract } from '@vers/contract-activity';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { activityRouter } from './activity-router';

export function buildActivityMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: activityContract,
    resolveContext: resolveSessionContext,
    router: activityRouter,
  });
}
