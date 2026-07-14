import { buildMockService } from '@vers/client-test-utils/orpc';
import { activityContract } from '@vers/contract-activity';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { activityRouter } from './activity-router';

/**
 * Builds the MSW handlers backing the activity contract's stateful mock backend at the given
 * origin.
 */
export function buildActivityMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: activityContract,
    resolveContext: resolveSessionContext,
    router: activityRouter,
  });
}
