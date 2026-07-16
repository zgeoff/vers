import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { setRewardSlotLedger } from '@vers/idle-client';
import * as db from '@vers/mock-services/db';
import { orpc } from '../../lib/rpc/orpc';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { renderWithRouter } from '../../test-utils/render-with-router';
import { withRequestContext } from '../../test-utils/with-request-context';
import { ActivityRewardsPanel } from './activity-rewards-panel';

test('it renders nothing without an active activity', () => {
  // no activity id means the query never runs, so this needs no session or MSW override
  renderWithRouter(<ActivityRewardsPanel activityID={undefined} orpc={orpc} />);
  expect(screen.queryByTestId('activity-rewards-panel')).not.toBeInTheDocument();
});

test('it renders settled reward items once the query resolves', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  const activity = await db.activityCollection.create({
    avatarID: avatar.id,
    id: 'activity_rewards_settled',
    verifiedHead: 3,
  });

  await db.avatarItemCollection.create({
    affixes: [{ affixID: 'affix_flat_damage', groupID: 'damage', value: 12 }],
    avatarID: activity.avatarID,
    baseID: 'base_longsword',
    chainIndex: 3,
    contentVersion: 'v1',
    ordinal: 0,
    rarityID: 'rare',
    scopeID: activity.scopeID,
    scopeType: activity.scopeType,
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<ActivityRewardsPanel activityID="activity_rewards_settled" orpc={orpc} />);

    const item = await screen.findByText(/base_longsword/i);

    expect(item).toBeVisible();
    expect(screen.getByText(/affix_flat_damage \+12/i)).toBeVisible();
    expect(screen.queryByTestId('activity-rewards-pending')).not.toBeInTheDocument();
  });
});

test('it shows the ambient catching-up line while ledger versions exceed the verified head', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    avatarID: avatar.id,
    id: 'activity_rewards_pending',
    verifiedHead: 3,
  });

  setRewardSlotLedger({
    activityID: 'activity_rewards_pending',
    entries: [
      { count: 2, version: 3 },
      { count: 4, version: 5 },
    ],
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<ActivityRewardsPanel activityID="activity_rewards_pending" orpc={orpc} />);

    const pending = await screen.findByTestId('activity-rewards-pending');

    // only the version-5 entry sits above the verified head of 3
    expect(pending).toHaveTextContent('Catching up… 4 rewards pending.');
  });
});

test('it hides the catching-up line once the verified head has caught up to every ledger version', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    avatarID: avatar.id,
    id: 'activity_rewards_caught_up',
    verifiedHead: 5,
  });

  setRewardSlotLedger({
    activityID: 'activity_rewards_caught_up',
    entries: [
      { count: 2, version: 3 },
      { count: 4, version: 5 },
    ],
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<ActivityRewardsPanel activityID="activity_rewards_caught_up" orpc={orpc} />);

    await screen.findByTestId('activity-rewards-panel');

    expect(screen.queryByTestId('activity-rewards-pending')).not.toBeInTheDocument();
  });
});

test('it shows no catching-up line when the ledger belongs to a different activity', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });

  await db.activityCollection.create({
    avatarID: avatar.id,
    id: 'activity_rendered',
    verifiedHead: 3,
  });

  setRewardSlotLedger({
    activityID: 'activity_other',
    entries: [{ count: 4, version: 5 }],
  });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<ActivityRewardsPanel activityID="activity_rendered" orpc={orpc} />);

    await screen.findByTestId('activity-rewards-panel');

    expect(screen.queryByTestId('activity-rewards-pending')).not.toBeInTheDocument();
  });
});
