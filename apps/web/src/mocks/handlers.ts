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
import { HttpResponse, http } from 'msw';
import { SERVICE_URLS } from '../lib/rpc/service-urls';

await createDemoSeed();

/**
 * Accepts the product-event beacons component flows fire in passing, so a covered flow never
 * trips the unhandled-request error; ingest-path suites still observe delivery with their own
 * per-test handlers. Matched by path alone: the Tinybird origin comes from env the preload
 * assigns after this module's imports have already evaluated.
 */
const tinybirdEventsHandler = http.post('*/v0/events', () =>
  HttpResponse.json({ quarantined_rows: 0, successful_rows: 1 }, { status: 202 }),
);

export const handlers: Array<HttpHandler> = [
  tinybirdEventsHandler,
  ...buildUserMockHandlers(SERVICE_URLS.user),
  ...buildSessionMockHandlers(SERVICE_URLS.session),
  ...buildVerificationMockHandlers(SERVICE_URLS.verification),
  ...buildAvatarMockHandlers(SERVICE_URLS.avatar),
  ...buildEmailMockHandlers(SERVICE_URLS.email),
  ...buildActivityMockHandlers(SERVICE_URLS.activity),
  ...buildKeysMockHandlers(SERVICE_URLS.keys),
  ...buildReplayMockHandlers(SERVICE_URLS.replay),
];
