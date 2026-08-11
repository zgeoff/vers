import { expect, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { sessionContract } from '@vers/contract-session';
import * as db from '@vers/mock-services/db';
import { server } from '../../../mocks/node';
import { SERVICE_URLS } from '../service-urls';
import { sessionExistenceClient } from './session-existence-client';

test('it attaches a traceparent header to the outbound getSession call', async () => {
  const session = await db.sessionCollection.create({ userID: 'user_1' });

  const mockSession = buildContractMock({
    baseUrl: SERVICE_URLS.session,
    contract: sessionContract,
    resolveContext: () => ({}),
  });

  const observedTraceparents: Array<string | null> = [];

  server.use(
    mockSession.getSession.handler((args) => {
      observedTraceparents.push(args.request.headers.get('traceparent'));

      return session;
    }),
  );

  await sessionExistenceClient.getSession(
    { id: session.id },
    { context: { actingUserID: 'user_1' } },
  );

  const [observedTraceparent] = observedTraceparents;

  expect(observedTraceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
});
