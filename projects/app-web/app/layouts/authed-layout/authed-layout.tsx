import { useEffect } from 'react';
import { Outlet } from 'react-router';
import {
  createInitializeMessage,
  useSimulationInitialized,
  useSimulationWorker,
} from '@vers/idle-client';
import { Header } from '~/components/header';
import { SideNavigation } from '~/components/side-navigation';
import { requireAuth } from '~/utils/require-auth.server';
import { withErrorHandling } from '~/utils/with-error-handling';
import type { Route } from './+types/authed-layout';
import * as styles from './authed-layout.styles';

export const loader = withErrorHandling(async (args: Route.LoaderArgs) => {
  await requireAuth(args.request);

  return {};
});

export function AuthedLayout(_props: Route.ComponentProps) {
  const worker = useSimulationWorker();
  const initialized = useSimulationInitialized();

  useEffect(() => {
    if (worker && !initialized) {
      const message = createInitializeMessage();

      worker.port.postMessage(message);
    }
  }, [worker, initialized]);

  return (
    <div className={styles.container}>
      {/* TODO: render current activity preview here */}
      <Header />
      <SideNavigation />
      <main className={styles.contentContainer}>
        <Outlet />
      </main>
    </div>
  );
}

export default AuthedLayout;
