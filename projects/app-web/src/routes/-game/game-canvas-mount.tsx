import { css } from '@vers/styled-system/css';
import { Suspense, lazy, memo } from 'react';

const LazyGameWorld = lazy(async () => {
  const module = await import('./game-world');

  return { default: module.GameWorld };
});

const MemoizedGameWorld = memo(LazyGameWorld);

const container = css({ inset: '0', position: 'fixed', zIndex: '[-1]' });

/**
 * The persistent canvas's client-lane host: three.js and the R3F canvas load only once this
 * component mounts, behind a `React.lazy` boundary, so they never land in the initial bundle. Fixed
 * full-viewport and behind the DOM lane, it mounts once in the game layout and survives every
 * child-route change.
 */
export function GameCanvasMount() {
  return (
    <div className={container}>
      <Suspense fallback={null}>
        <MemoizedGameWorld />
      </Suspense>
    </div>
  );
}
