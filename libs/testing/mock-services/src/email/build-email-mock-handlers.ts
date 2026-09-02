import { buildMockService } from '@vers/client-test-utils/orpc';
import { emailContract } from '@vers/contract-email';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { emailRouter } from './email-router';

export function buildEmailMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: emailContract,
    resolveContext: resolveSessionContext,
    router: emailRouter,
  });
}
