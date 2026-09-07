import { useWriterGeneration } from '@vers/idle-client';
import { useEffect } from 'react';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { isQADebugHookEnabled } from '../../lib/qa/is-qa-debug-hook-enabled';
import { registerQADebugHook } from '../../lib/qa/register-qa-debug-hook';

// one id per page load, outside the component: the game layout remounts on account-screen
// visits, and the hook must keep naming the same tab across them
const TAB_ID = crypto.randomUUID();

interface QADebugHookMountProps {
  readonly qaAccount: boolean;
}

export function QADebugHookMount(props: Readonly<QADebugHookMountProps>) {
  const idleWorkerHandle = useIdleWorkerHandle();
  const writerGeneration = useWriterGeneration();
  const client = idleWorkerHandle.client;
  const qaAccount = props.qaAccount;

  useEffect(() => {
    const enabled = isQADebugHookEnabled({
      dev: import.meta.env.DEV,
      qaAccount,
      search: globalThis.location.search,
    });

    const unregister =
      client !== undefined && enabled
        ? registerQADebugHook({ client, tabID: TAB_ID, writerGeneration })
        : null;

    return () => {
      unregister?.();
    };
  }, [client, qaAccount, writerGeneration]);

  return null;
}
