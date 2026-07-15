import { expect, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import * as db from '@vers/mock-services/db';
import { buildQueryClient } from '../../lib/query/build-query-client';
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

test('it shows exactly one catching-up indicator while appended progress is still settling', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 3,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByTestId('catching-up-indicator')).toHaveLength(1);
    });

    expect(screen.getByTestId('catching-up-indicator')).toHaveTextContent(
      'Catching up — 1 reward settling',
    );
  });
});

test('it pluralizes the catching-up notice when several rewards are settling', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 5,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getByTestId('catching-up-indicator')).toHaveTextContent(
        'Catching up — 3 rewards settling',
      );
    });
  });
});

test('it shows no catching-up indicator once the appended progress is fully verified', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    appendedHead: 2,
    avatarID: avatar.id,
    status: 'active',
    verifiedHead: 2,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByTestId('character-frame')).toHaveLength(3);
    });

    expect(screen.queryByTestId('catching-up-indicator')).not.toBeInTheDocument();
  });
});
