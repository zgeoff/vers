import { expect, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { buildQueryClient } from '../../lib/query/build-query-client';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ActivityPanel } from './activity-panel';

function renderPanel() {
  const queryClient = buildQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <ActivityPanel />
    </QueryClientProvider>,
  );
}

test('it renders the activity title and character frames with no catching-up indicator by default', () => {
  renderPanel();
  expect(screen.getByRole('heading', { name: 'Activity' })).toBeVisible();
  expect(screen.getAllByTestId('character-frame')).toHaveLength(3);
  expect(screen.queryByTestId('catching-up-indicator')).not.toBeInTheDocument();
});

test('it shows exactly one catching-up indicator while a revealed reward is still pending', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });

  server.use(
    mockActivityService.getActivityRewards.handler(() => ({
      items: [
        {
          chainIndex: 5,
          item: { affixes: [], baseID: 'base_1', contentVersion: '1', rarityID: 'common' },
          ordinal: 0,
        },
      ],
      verifiedHead: 2,
    })),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByTestId('catching-up-indicator')).toHaveLength(1);
    });

    expect(screen.getByTestId('catching-up-indicator')).toHaveTextContent(
      'Catching up — 1 rewards settling',
    );
  });
});

test('it shows no catching-up indicator once every revealed reward is verified', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({ avatarID: avatar.id, status: 'active' });

  server.use(
    mockActivityService.getActivityRewards.handler(() => ({
      items: [
        {
          chainIndex: 2,
          item: { affixes: [], baseID: 'base_1', contentVersion: '1', rarityID: 'common' },
          ordinal: 0,
        },
      ],
      verifiedHead: 2,
    })),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByTestId('character-frame')).toHaveLength(3);
    });

    expect(screen.queryByTestId('catching-up-indicator')).not.toBeInTheDocument();
  });
});
