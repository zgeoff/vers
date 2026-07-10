import { useSceneState } from '@vers/game-rendering';
import { css, cx } from '@vers/styled-system/css';
import { Suspense, lazy, memo } from 'react';

const LazyGameWorld = lazy(async () => {
  const module = await import('./game-world');

  return { default: module.GameWorld };
});

const MemoizedGameWorld = memo(LazyGameWorld);

const container = css({
  inset: '0',
  position: 'fixed',
  transition: 'opacity',
  transitionDuration: 'normal',
  zIndex: '[-1]',
});

const ambient = css({ opacity: '[0.4]' });

/**
 * The persistent canvas's client-lane host: three.js and the R3F canvas load only once this
 * component mounts, behind a `React.lazy` boundary, so they never land in the initial bundle. Fixed
 * full-viewport and behind the DOM lane, it mounts once in the game layout and survives every
 * child-route change. It dims while the current route's presentation is `ambient`, so the world
 * visibly recedes behind the HTML panel in front of it.
 */
export function GameCanvasMount() {
  const presentation = useSceneState().presentation;

  return (
    <div className={cx(container, presentation === 'ambient' && ambient)}>
      <Suspense fallback={null}>
        <MemoizedGameWorld />
      </Suspense>
    </div>
  );
}
