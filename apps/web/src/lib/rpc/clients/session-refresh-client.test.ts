import { expect, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { sessionContract } from '@vers/contract-session';
import { createTestAccessToken } from '@vers/mock-services';
import * as db from '@vers/mock-services/db';
import { server } from '../../../mocks/node';
import { SERVICE_URLS } from '../service-urls';
import { sessionRefreshClient } from './session-refresh-client';

test('it attaches a traceparent header to the outbound refreshTokens call', async () => {
  const session = await db.sessionCollection.create({ refreshToken: 'refresh-token' });

  const mockSession = buildContractMock({
    baseUrl: SERVICE_URLS.session,
    contract: sessionContract,
    resolveContext: () => ({}),
  });

  const observedTraceparents: Array<string | null> = [];

  server.use(
    mockSession.refreshTokens.handler(async (args) => {
      observedTraceparents.push(args.request.headers.get('traceparent'));

      return {
        accessToken: await createTestAccessToken(session.userID),
        refreshToken: 'rotated-refresh-token',
      };
    }),
  );

  await sessionRefreshClient.refreshTokens({ id: session.id, refreshToken: 'refresh-token' });

  const [observedTraceparent] = observedTraceparents;

  expect(observedTraceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
});
