import { createDemoSeed } from '@vers/mock-services';
import { buildActivityMockHandlers } from '@vers/mock-services/activity';
import { buildAvatarMockHandlers } from '@vers/mock-services/avatar';
import { buildEmailMockHandlers } from '@vers/mock-services/email';
import { buildKeysMockHandlers } from '@vers/mock-services/keys';
import { buildReplayMockHandlers } from '@vers/mock-services/replay';
import { buildSessionMockHandlers } from '@vers/mock-services/session';
import { buildUserMockHandlers } from '@vers/mock-services/user';
import { buildVerificationMockHandlers } from '@vers/mock-services/verification';
import type { HttpHandler } from 'msw';
import { SERVICE_URLS } from '../lib/rpc/service-urls';

await createDemoSeed();

export const handlers: Array<HttpHandler> = [
  ...buildUserMockHandlers(SERVICE_URLS.user),
  ...buildSessionMockHandlers(SERVICE_URLS.session),
  ...buildVerificationMockHandlers(SERVICE_URLS.verification),
  ...buildAvatarMockHandlers(SERVICE_URLS.avatar),
  ...buildEmailMockHandlers(SERVICE_URLS.email),
  ...buildActivityMockHandlers(SERVICE_URLS.activity),
  ...buildKeysMockHandlers(SERVICE_URLS.keys),
  ...buildReplayMockHandlers(SERVICE_URLS.replay),
];
