import { expect, mock, test } from 'bun:test';
import { HttpResponse, http } from 'msw';
import { server } from '../mocks/node';
import { writeDiscordAlert } from './write-discord-alert';

test('it posts the alert to the webhook as one critical embed', async () => {
  const received = mock();

  server.use(
    http.post('https://discord.test/api/webhooks/7/token', async (info) => {
      const body: unknown = await info.request.json();

      received(body);

      return new HttpResponse(null, { status: 204 });
    }),
  );

  const outcome = await writeDiscordAlert({
    WEBHOOK_URL: 'https://discord.test/api/webhooks/7/token',
    RUN_URL: 'https://github.com/acme/kiln/actions/runs/42',
    ALERT_TITLE: '[CI] critical — main pipeline failed',
    ALERT_DESCRIPTION: 'add the glaze picker\n\nThe picker lists every glaze.',
    ALERT_FAILED_JOBS: 'checks=success, deploy=failure',
  });

  expect(outcome).toBe('sent');

  expect(received).toHaveBeenCalledExactlyOnceWith({
    embeds: [
      {
        title: '[CI] critical — main pipeline failed',
        url: 'https://github.com/acme/kiln/actions/runs/42',
        description: 'add the glaze picker',
        color: 15_026_253,
        fields: [{ name: 'Failed jobs', value: 'checks=success, deploy=failure' }],
      },
    ],
  });
});

test('it leaves out the failed-jobs field when the step passes an empty list', async () => {
  const received = mock();

  server.use(
    http.post('https://discord.test/api/webhooks/7/token', async (info) => {
      const body: unknown = await info.request.json();

      received(body);

      return new HttpResponse(null, { status: 204 });
    }),
  );

  await writeDiscordAlert({
    WEBHOOK_URL: 'https://discord.test/api/webhooks/7/token',
    RUN_URL: 'https://github.com/acme/kiln/actions/runs/42',
    ALERT_TITLE: '[CI] critical — nightly sweep failed',
    ALERT_DESCRIPTION: 'the sweep failed; open the run',
    ALERT_FAILED_JOBS: '',
  });

  expect(received).toHaveBeenCalledExactlyOnceWith({
    embeds: [
      {
        title: '[CI] critical — nightly sweep failed',
        url: 'https://github.com/acme/kiln/actions/runs/42',
        description: 'the sweep failed; open the run',
        color: 15_026_253,
      },
    ],
  });
});

test('it sends nothing when the webhook secret is empty', async () => {
  const outcome = await writeDiscordAlert({
    WEBHOOK_URL: '',
    RUN_URL: 'https://github.com/acme/kiln/actions/runs/42',
    ALERT_TITLE: '[CI] critical — nightly sweep failed',
    ALERT_DESCRIPTION: 'the sweep failed; open the run',
  });

  expect(outcome).toBe('no-webhook');
});

test('it rejects a webhook answer that is not a success', () => {
  server.use(
    http.post('https://discord.test/api/webhooks/7/token', () =>
      HttpResponse.json({ message: 'Unknown Webhook' }, { status: 404 }),
    ),
  );

  expect(
    writeDiscordAlert({
      WEBHOOK_URL: 'https://discord.test/api/webhooks/7/token',
      RUN_URL: 'https://github.com/acme/kiln/actions/runs/42',
      ALERT_TITLE: '[CI] critical — nightly sweep failed',
      ALERT_DESCRIPTION: 'the sweep failed; open the run',
    }),
  ).rejects.toThrowWithMessage(Error, /answered 404/u);
});

test('it rejects a step that sets no alert title', () => {
  expect(
    writeDiscordAlert({
      WEBHOOK_URL: 'https://discord.test/api/webhooks/7/token',
      RUN_URL: 'https://github.com/acme/kiln/actions/runs/42',
      ALERT_DESCRIPTION: 'the sweep failed; open the run',
    }),
  ).rejects.toThrowWithMessage(Error, /ALERT_TITLE must be set/u);
});
