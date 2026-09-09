import { expect, test } from 'bun:test';
import { buildContractMock } from '@vers/client-test-utils/orpc';
import { sessionContract } from '@vers/contract-session';
import { buildTestSigningKeySet } from '@vers/mock-services';
import { server } from '../../../mocks/node';
import { SERVICE_URLS } from '../service-urls';
import { sessionKeysClient } from './session-keys-client';

test('it attaches a traceparent header to the outbound getSigningKeys call', async () => {
  const mockSession = buildContractMock({
    baseUrl: SERVICE_URLS.session,
    contract: sessionContract,
    resolveContext: () => ({}),
  });

  const observedTraceparents: Array<string | null> = [];

  server.use(
    mockSession.getSigningKeys.handler(async (args) => {
      observedTraceparents.push(args.request.headers.get('traceparent'));

      const published = await buildTestSigningKeySet();

      return published.keySet;
    }),
  );

  await sessionKeysClient.getSigningKeys({});

  const [observedTraceparent] = observedTraceparents;

  expect(observedTraceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/u);
});
