import { expect, mock, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { createMockRevealedReward } from '../../test-utils/factories/create-mock-revealed-reward';
import { renderHook } from '../../test-utils/render-hook';
import { withRequestContext } from '../../test-utils/with-request-context';
import { useActivityRewards } from './use-activity-rewards';

test('it is disabled with no activityID', () => {
  const hook = renderHook(() => useActivityRewards(undefined));

  expect(hook.result.current.isPending).toBeTrue();
  expect(hook.result.current.fetchStatus).toBe('idle');
});

test('it fetches the first page, then passes the cursor from the merged cache on the next poll', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id });

  const track = mock<(input: unknown) => void>();

  server.use(
    mockActivityService.getActivityRewards.handler((opts) => {
      track(opts.input);

      if (track.mock.calls.length === 1) {
        return {
          items: [createMockRevealedReward({ chainIndex: 3 })],
          verifiedHead: 2,
        };
      }

      return { items: [], verifiedHead: 2 };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => useActivityRewards(activity.id));

    await waitFor(() => {
      expect(hook.result.current.data?.items).toHaveLength(1);
    });

    expect(track).toHaveBeenCalledExactlyOnceWith({ activityID: activity.id });

    await hook.result.current.refetch();

    await waitFor(() => {
      expect(track).toHaveBeenCalledTimes(2);
    });

    expect(track).toHaveBeenLastCalledWith({ activityID: activity.id, afterChainIndex: 3 });
  });
});
