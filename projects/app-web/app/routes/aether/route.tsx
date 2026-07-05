import { Spinner } from '@vers/design-system';
import * as React from 'react';
import * as styles from './route.styles';

export function AetherRoute() {
  return (
    <div className={styles.container}>
      <React.Suspense fallback={<Spinner />}>
        <MemoizedAether />
      </React.Suspense>
    </div>
  );
}

const Aether = React.lazy(async () => {
  const module = await import('./aether');

  return { default: module.Aether };
});

const MemoizedAether = React.memo(Aether);

export default AetherRoute;
