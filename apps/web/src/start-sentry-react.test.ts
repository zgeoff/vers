import { expect, onTestFinished, test } from 'bun:test';
import * as Sentry from '@sentry/react';
import type { Event } from '@sentry/react';
import { waitFor } from '@vers/test-utils';
import { updateEnv } from '@vers/test-utils/bun';
import invariant from 'tiny-invariant';
import { startSentryReact } from './start-sentry-react';

test('it gives an event captured from a non-Error value no synthetic stack', async () => {
  const recorded: Array<Event> = [];

  updateEnv('VITE_SENTRY_DSN', 'https://testpublickey@o0.ingest.sentry.io/1');
  startSentryReact({ disableDefaultIntegrations: true });

  onTestFinished(async () => {
    await Sentry.close();
  });

  Sentry.addEventProcessor((event) => {
    recorded.push(event);

    return null;
  });

  Sentry.captureException('the avatar list is unreachable');

  await waitFor(() => {
    expect(recorded).toHaveLength(1);
  });

  const exception = recorded[0]?.exception?.values?.[0];

  invariant(exception, 'the non-Error capture was recorded as an exception');

  expect(exception.stacktrace).toBeUndefined();
});
