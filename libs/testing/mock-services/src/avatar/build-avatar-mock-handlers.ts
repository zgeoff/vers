import { buildMockService } from '@vers/client-test-utils/orpc';
import { avatarContract } from '@vers/contract-avatar';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { avatarRouter } from './avatar-router';

/**
 * Builds the MSW handlers backing the avatar contract's stateful mock backend at the given origin.
 */
export function buildAvatarMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: avatarContract,
    resolveContext: resolveSessionContext,
    router: avatarRouter,
  });
}
