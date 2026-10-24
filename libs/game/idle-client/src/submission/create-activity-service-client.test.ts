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
  const client = createActivityServiceClient({ onSessionSuperseded });

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
  const client = createActivityServiceClient({ onSessionSuperseded });

  await expect(client.stopActivity({ avatarID: 'avatar-1' })).toReject();

  expect(onSessionSuperseded).not.toHaveBeenCalled();
});
