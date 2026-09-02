import { buildMockService } from '@vers/client-test-utils/orpc';
import { avatarContract } from '@vers/contract-avatar';
import type { HttpHandler } from 'msw';
import { resolveSessionContext } from '../resolve-session-context';
import { avatarRouter } from './avatar-router';

export function buildAvatarMockHandlers(baseUrl: string): Array<HttpHandler> {
  return buildMockService({
    baseUrl,
    contract: avatarContract,
    resolveContext: resolveSessionContext,
    router: avatarRouter,
  });
}
