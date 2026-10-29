import { expect, mock, test } from 'bun:test';
import { buildSessionSupersededResponse } from '@vers/service-utils/orpc';
import { HttpResponse, http } from 'msw';
import { server } from '../mocks/node';
import { createActivityServiceClient } from './create-activity-service-client';

test('it reports a superseded session when the proxy marks the refusal', async () => {
  server.use(
    http.post(`${self.location.origin}/api/rpc/activity/stopActivity`, () =>
      buildSessionSupersededResponse(),
    ),
  );

  const onSessionSuperseded = mock(() => {});
  const client = createActivityServiceClient({ onExchangeFailed: () => {}, onSessionSuperseded });

  await expect(client.stopActivity({ avatarID: 'avatar-1' })).toReject();

  expect(onSessionSuperseded).toHaveBeenCalledOnce();
});

test('it reports nothing when a refusal carries no superseded marker', async () => {
  server.use(
    http.post(`${self.location.origin}/api/rpc/activity/stopActivity`, () =>
      HttpResponse.json(null, { status: 401 }),
    ),
  );

  const onSessionSuperseded = mock(() => {});
  const client = createActivityServiceClient({ onExchangeFailed: () => {}, onSessionSuperseded });

  await expect(client.stopActivity({ avatarID: 'avatar-1' })).toReject();

  expect(onSessionSuperseded).not.toHaveBeenCalled();
});

test('it reports the procedure and status of an exchange the service answered with an error', async () => {
  server.use(
    http.post(`${self.location.origin}/api/rpc/activity/stopActivity`, () =>
      HttpResponse.json(null, { status: 409 }),
    ),
  );

  const onExchangeFailed = mock((_detail: string) => {});
  const client = createActivityServiceClient({ onExchangeFailed, onSessionSuperseded: () => {} });

  await expect(client.stopActivity({ avatarID: 'avatar-1' })).toReject();

  expect(onExchangeFailed).toHaveBeenCalledExactlyOnceWith('stopActivity answered 409');
});

test('it reports an exchange the service never answered', async () => {
  server.use(
    http.post(`${self.location.origin}/api/rpc/activity/stopActivity`, () => HttpResponse.error()),
  );

  const onExchangeFailed = mock((_detail: string) => {});
  const client = createActivityServiceClient({ onExchangeFailed, onSessionSuperseded: () => {} });

  await expect(client.stopActivity({ avatarID: 'avatar-1' })).toReject();

  expect(onExchangeFailed).toHaveBeenCalledExactlyOnceWith('stopActivity unanswered TypeError');
});

test('it reports nothing for an exchange the service answered with success', async () => {
  server.use(
    http.post(`${self.location.origin}/api/rpc/activity/stopActivity`, () =>
      HttpResponse.json({ json: null }),
    ),
  );

  const onExchangeFailed = mock((_detail: string) => {});
  const client = createActivityServiceClient({ onExchangeFailed, onSessionSuperseded: () => {} });

  await expect(client.stopActivity({ avatarID: 'avatar-1' })).toResolve();

  expect(onExchangeFailed).not.toHaveBeenCalled();
});
