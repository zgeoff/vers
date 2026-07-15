import { expect, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivitySnapshot, createMockAvatarSnapshot } from '@vers/idle-core/test-utils';
import * as db from '@vers/mock-services/db';
import { buildQueryClient } from '../../lib/query/build-query-client';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withIdleWorkerHandle } from '../../test-utils/with-idle-worker-handle';
import { withRequestContext } from '../../test-utils/with-request-context';
import { AvatarProgression } from './avatar-progression';

function renderProgression() {
  const queryClient = buildQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <AvatarProgression />
    </QueryClientProvider>,
  );
}

test('it renders nothing without a signed-in avatar', async () => {
  await withRequestContext({}, async () => {
    const rendered = renderProgression();

    await waitFor(() => {
      expect(rendered.container).toBeEmptyDOMElement();
    });
  });
});

test('it renders the settled avatar row when no activity is current', async () => {
  const signedIn = await createSignedInUser();

  await db.avatarCollection.create({ level: 5, userID: signedIn.userID, xp: 900 });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderProgression();

    const level = await screen.findByTestId('avatar-level');

    expect(level).toHaveTextContent('Level 5');
    expect(screen.getByTestId('avatar-xp')).toHaveTextContent('XP: 900');
  });
});

test('it shows the optimistic total instead of the settled xp while an activity is current', async () => {
  const signedIn = await createSignedInUser();

  const avatar = await db.avatarCollection.create({
    level: 3,
    userID: signedIn.userID,
    xp: 450,
  });

  const activity = await db.activityCollection.create({
    avatarID: avatar.id,
    buildSnapshot: { level: 3, xp: 400 },
    status: 'active',
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    await withIdleWorkerHandle(
      {
        activity: createMockActivitySnapshot({ id: activity.id, rewards: { xp: 25 } }),
        avatar: createMockAvatarSnapshot({ level: 3 }),
        failureAction: ActivityFailureAction.Retry,
        initialized: true,
        worker: undefined,
      },
      async () => {
        renderProgression();

        const xp = await screen.findByTestId('avatar-xp');

        expect(xp).toHaveTextContent('XP: 425');
        expect(xp).not.toHaveTextContent('XP: 450');
      },
    );
  });
});
