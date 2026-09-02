import { buildMockService } from '@vers/client-test-utils/orpc';
import { verificationContract } from '@vers/contract-verification';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { verificationRouter } from './verification-router';

export function buildVerificationMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: verificationContract,
    resolveContext: resolveSessionContext,
    router: verificationRouter,
  });
}
