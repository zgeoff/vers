import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import type { ClientMessage } from '@vers/idle-client';
import { ClientMessageType, setSimulationSnapshot } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot, createMockAvatarSnapshot } from '@vers/idle-core/test-utils';
import * as db from '@vers/mock-services/db';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { render } from '../../test-utils/render';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { setIdleWorkerHandle } from '../../test-utils/set-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ActivityPanel } from './activity-panel';

test('it renders the engagement title with no settling indicator by default', () => {
  const rendered = render(<ActivityPanel />);

  expect(rendered.getByRole('heading', { name: 'Engagement' })).toBeVisible();
  expect(rendered.queryByTestId('settling-indicator')).not.toBeInTheDocument();
});

test('it shows the settling indicator while appended progress is still settling', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 3,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ActivityPanel />);

    await waitFor(() => {
      expect(rendered.getAllByTestId('settling-indicator')).toHaveLength(1);
    });
  });
});

test('it shows no settling indicator once the appended progress is fully verified', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 2,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ActivityPanel />);

    await waitFor(() => {
      expect(rendered.getByRole('heading', { name: 'Engagement' })).toBeVisible();
    });

    expect(rendered.queryByTestId('settling-indicator')).not.toBeInTheDocument();
  });
});

test('it hands END RUN to the worker and never awaits the server', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });

  const calls: Array<ClientMessage> = [];
  const worker = { port: { postMessage: (message: ClientMessage) => calls.push(message) } };

  setIdleWorkerHandle({
    activity: createMockActivitySnapshot(),
    avatar: createMockAvatarSnapshot(),
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    worker,
  });

  setSimulationSnapshot({
    activity: createMockActivitySnapshot(),
    avatar: createMockAvatarSnapshot(),
    failureAction: ActivityFailureAction.Abort,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = renderWithRouter(<ActivityPanel />);

    const endRunButton = await rendered.findByRole('button', { name: 'END RUN' });

    endRunButton.click();

    await waitFor(() => {
      expect(calls).toStrictEqual([
        {
          activityID: activity.id,
          avatarID: avatar.id,
          type: ClientMessageType.StopActivity,
        },
      ]);
    });
  });
});
