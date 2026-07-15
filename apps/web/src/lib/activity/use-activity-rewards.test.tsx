import { expect, mock, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { mockActivityService } from '@vers/mock-services/activity';
import * as db from '@vers/mock-services/db';
import { server } from '../../mocks/node';
import { createSignedInUser } from '../../test-utils/create-signed-in-user';
import { withRequestContext } from '../../test-utils/with-request-context';
import { buildQueryClient } from '../query/build-query-client';
import { useActivityRewards } from './use-activity-rewards';

function buildWrapper() {
  const queryClient = buildQueryClient();

  return function Wrapper(props: Readonly<{ children: React.ReactNode }>) {
    return <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>;
  };
}

test('it is disabled with no activityID', () => {
  const hook = renderHook(() => useActivityRewards(undefined), { wrapper: buildWrapper() });

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
          items: [
            {
              chainIndex: 3,
              item: { affixes: [], baseID: 'base_1', contentVersion: '1', rarityID: 'common' },
              ordinal: 0,
            },
          ],
          verifiedHead: 2,
        };
      }

      return { items: [], verifiedHead: 2 };
    }),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => useActivityRewards(activity.id), { wrapper: buildWrapper() });

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

test('it derives a pending item from one whose chainIndex is past the verified head', async () => {
  const signedIn = await createSignedInUser();
  const avatar = await db.avatarCollection.create({ userID: signedIn.userID });
  const activity = await db.activityCollection.create({ avatarID: avatar.id });

  server.use(
    mockActivityService.getActivityRewards.handler(() => ({
      items: [
        {
          chainIndex: 1,
          item: { affixes: [], baseID: 'base_1', contentVersion: '1', rarityID: 'common' },
          ordinal: 0,
        },
        {
          chainIndex: 5,
          item: { affixes: [], baseID: 'base_2', contentVersion: '1', rarityID: 'common' },
          ordinal: 0,
        },
      ],
      verifiedHead: 2,
    })),
  );

  await withRequestContext({ cookies: signedIn.cookies }, async () => {
    const hook = renderHook(() => useActivityRewards(activity.id), { wrapper: buildWrapper() });

    await waitFor(() => {
      expect(hook.result.current.data?.items).toHaveLength(2);
    });

    const verifiedHead = hook.result.current.data?.verifiedHead;

    const pending = hook.result.current.data?.items.filter(
      (item) => item.chainIndex > (verifiedHead ?? 0),
    );

    const final = hook.result.current.data?.items.filter(
      (item) => item.chainIndex <= (verifiedHead ?? 0),
    );

    expect(pending).toHaveLength(1);
    expect(final).toHaveLength(1);
  });
});
