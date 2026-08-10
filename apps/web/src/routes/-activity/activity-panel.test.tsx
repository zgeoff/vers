import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { setSimulationSnapshot } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot, createMockAvatarSnapshot } from '@vers/idle-core/test-utils';
import * as db from '@vers/mock-services/db';
import { createActiveAvatar } from '../../test-utils/create-active-avatar';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createStubWorkerClient } from '../../test-utils/create-stub-worker-client';
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
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 3,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ActivityPanel />);

    const indicators = await rendered.findAllByTestId('settling-indicator');

    expect(indicators).toHaveLength(1);
  });
});

test('it shows no settling indicator once the appended progress is fully verified', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 2,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const rendered = render(<ActivityPanel />);

    const heading = await rendered.findByRole('heading', { name: 'Engagement' });

    expect(heading).toBeVisible();
    expect(rendered.queryByTestId('settling-indicator')).not.toBeInTheDocument();
  });
});

test('it hands END RUN to the worker and never awaits the server', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await createActiveAvatar({ userID: signedIn.userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });

  const client = createStubWorkerClient();

  setIdleWorkerHandle({
    activity: createMockActivitySnapshot(),
    avatar: createMockAvatarSnapshot(),
    client,
    failureAction: ActivityFailureAction.Abort,
    initialized: true,
    writerAbortSignal: new AbortController().signal,
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
      expect(client.stopActivity).toHaveBeenCalledExactlyOnceWith(
        { activityID: activity.id, avatarID: avatar.id },
        expect.anything(),
      );
    });
  });
});
