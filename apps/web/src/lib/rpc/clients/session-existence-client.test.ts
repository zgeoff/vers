import { expect, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { sessionContract } from '@vers/contract-session';
import { server } from '../../../mocks/node';
import { SERVICE_URLS } from '../service-urls';
import { sessionExistenceClient } from './session-existence-client';

function setupTest() {
  return {
    mockSession: buildContractMock({
      baseUrl: SERVICE_URLS.session,
      contract: sessionContract,
      resolveContext: () => ({}),
    }),
  };
}

test('it attaches a traceparent header to the outbound getSession call', async () => {
  const ctx = setupTest();
  const observedTraceparents: Array<string | null> = [];

  server.use(
    ctx.mockSession.getSession.handler((args) => {
      observedTraceparents.push(args.request.headers.get('traceparent'));

      return null;
    }),
  );

  await sessionExistenceClient.getSession(
    { id: 'session_1' },
    { context: { actingUserID: 'user_1' } },
  );

  const [observedTraceparent] = observedTraceparents;

  expect(observedTraceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
});
