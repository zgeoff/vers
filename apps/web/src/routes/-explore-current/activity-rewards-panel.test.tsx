import { expect, test } from 'bun:test';
import { screen } from '@testing-library/react';
import { updateRewardSlotLedger } from '@vers/idle-client';
import { mockActivityService } from '@vers/mock-services/activity';
import { orpc } from '../../lib/rpc/orpc';
import { server } from '../../mocks/node';
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

  server.use(
    mockActivityService.getActivityRewards.handler({
      items: [
        {
          chainIndex: 3,
          item: {
            affixes: [{ affixID: 'affix_flat_damage', groupID: 'damage', value: 12 }],
            baseID: 'base_longsword',
            contentVersion: 'v1',
            rarityID: 'rare',
          },
          ordinal: 0,
        },
      ],
      verifiedHead: 3,
    }),
  );

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

  server.use(mockActivityService.getActivityRewards.handler({ items: [], verifiedHead: 3 }));

  updateRewardSlotLedger({ activityID: 'activity_rewards_pending', count: 2, version: 3 });
  updateRewardSlotLedger({ activityID: 'activity_rewards_pending', count: 4, version: 5 });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<ActivityRewardsPanel activityID="activity_rewards_pending" orpc={orpc} />);

    const pending = await screen.findByTestId('activity-rewards-pending');

    // only the version-5 entry sits above the verified head of 3
    expect(pending).toHaveTextContent('Catching up… 4 rewards pending.');
  });
});

test('it hides the catching-up line once the verified head has caught up to every ledger version', async () => {
  const signedIn = await createSignedInUser();

  server.use(mockActivityService.getActivityRewards.handler({ items: [], verifiedHead: 5 }));

  updateRewardSlotLedger({ activityID: 'activity_rewards_caught_up', count: 2, version: 3 });
  updateRewardSlotLedger({ activityID: 'activity_rewards_caught_up', count: 4, version: 5 });

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    renderWithRouter(<ActivityRewardsPanel activityID="activity_rewards_caught_up" orpc={orpc} />);

    await screen.findByTestId('activity-rewards-panel');

    expect(screen.queryByTestId('activity-rewards-pending')).not.toBeInTheDocument();
  });
});
