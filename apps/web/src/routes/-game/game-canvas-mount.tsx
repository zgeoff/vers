import { useSceneState } from '@vers/game-rendering';
import { css, cx } from '@vers/styled-system/css';
import { Suspense, lazy, memo } from 'react';

interface GameCanvasMountProps {
  readonly gameRenderer?: boolean;
}

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
  // its own view-transition group so the live canvas keeps rendering through a route transition
  // instead of freezing into the root snapshot
  viewTransitionName: 'game-canvas',
  zIndex: '[-1]',
});

const ambient = css({ opacity: '[0.4]' });
const placeholder = css({ display: '[block]', height: '[100%]', width: '[100%]' });

/**
 * The persistent canvas's client-lane host: three.js and the R3F canvas load only once this
 * component mounts, behind a `React.lazy` boundary, so they never land in the initial bundle. Fixed
 * full-viewport and behind the DOM lane, it mounts once in the game layout and survives every
 * child-route change. It dims while the current route's presentation is `ambient`, so the world
 * visibly recedes behind the HTML panel in front of it. With `gameRenderer` false, the same slot
 * holds an inert `<canvas>` — no three.js, no GPU context — so the persistent-canvas wiring stays
 * exercisable without the renderer's main-thread cost.
 */
export function GameCanvasMount(props: Readonly<GameCanvasMountProps>) {
  const isAmbient = useSceneState((state) => state.presentation === 'ambient');

  return (
    <div className={cx(container, isAmbient && ambient)}>
      {(props.gameRenderer ?? true) ? (
        <Suspense fallback={null}>
          <MemoizedGameWorld />
        </Suspense>
      ) : (
        <canvas className={placeholder} />
      )}
    </div>
  );
}
