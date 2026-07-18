import { expect, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { sessionContract } from '@vers/contract-session';
import { server } from '../../../mocks/node';
import { createMockSessionTokens } from '../../../test-utils/factories/create-mock-session-tokens';
import { SERVICE_URLS } from '../service-urls';
import { sessionRefreshClient } from './session-refresh-client';

function setupTest() {
  return {
    mockSession: buildContractMock({
      baseUrl: SERVICE_URLS.session,
      contract: sessionContract,
      resolveContext: () => ({}),
    }),
  };
}

test('it attaches a traceparent header to the outbound refreshTokens call', async () => {
  const ctx = setupTest();
  const observedTraceparents: Array<string | null> = [];

  server.use(
    ctx.mockSession.refreshTokens.handler((args) => {
      observedTraceparents.push(args.request.headers.get('traceparent'));

      return createMockSessionTokens();
    }),
  );

  await sessionRefreshClient.refreshTokens({ id: 'session_1', refreshToken: 'refresh-token' });

  const [observedTraceparent] = observedTraceparents;

  expect(observedTraceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
});
