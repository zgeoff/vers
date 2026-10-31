import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { useWriterGeneration } from '@vers/idle-client';
import { useEffect } from 'react';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { isQADebugHookEnabled } from '../../lib/qa/is-qa-debug-hook-enabled';
import { registerQADebugHook } from '../../lib/qa/register-qa-debug-hook';

// one id per page load, outside the component: the game layout remounts on account-screen
// visits, and the hook must keep naming the same tab across them
const TAB_ID = crypto.randomUUID();

// a live worker answers a snapshot within milliseconds, so a few seconds marks one that hangs
const WORKER_TIMEOUT_MS = 3000;

interface QADebugHookMountProps {
  readonly qaAccount: boolean;
}

export function QADebugHookMount(props: Readonly<QADebugHookMountProps>) {
  const idleWorkerHandle = useIdleWorkerHandle();
  const writerGeneration = useWriterGeneration();
  const search = useRouterState({ select: (state) => state.location.searchStr });
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const client = idleWorkerHandle.client;
  const qaAccount = props.qaAccount;
  const isQAAvatar = avatarQuery.data?.isQA ?? false;

  useEffect(() => {
    const enabled = isQADebugHookEnabled({
      nonProductionBuild: import.meta.env.MODE !== 'production',
      qaAccount,
      search,
    });

    const unregister =
      client !== undefined && enabled
        ? registerQADebugHook({
            client,
            isQAAvatar,
            storage: { captures: localStorage, outcomes: sessionStorage },
            tabID: TAB_ID,
            workerTimeoutMs: WORKER_TIMEOUT_MS,
            writerGeneration,
          })
        : null;

    return () => {
      unregister?.();
    };
  }, [client, isQAAvatar, qaAccount, search, writerGeneration]);

  return null;
}
