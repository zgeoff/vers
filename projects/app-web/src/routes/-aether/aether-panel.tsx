import { Spinner } from '@vers/design-system';
import { Suspense, lazy, memo } from 'react';

const LazyAetherCanvas = lazy(async () => {
  const module = await import('./aether-canvas');

  return { default: module.AetherCanvas };
});

const MemoizedAetherCanvas = memo(LazyAetherCanvas);

/**
 * The aether map's client-lane host: three.js and the R3F canvas load only once this component
 * mounts, behind a `React.lazy` boundary, so they never land in the initial bundle.
 */
export function AetherPanel() {
  return (
    <Suspense fallback={<Spinner />}>
      <MemoizedAetherCanvas />
    </Suspense>
  );
}
