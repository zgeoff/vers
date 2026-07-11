import { useMatches } from '@tanstack/react-router';
import { setSceneState } from '@vers/game-rendering';
import { useEffect, useRef } from 'react';

/**
 * The sole entry point for route state into the scene store: `useMatches` resolves root-first, so
 * folding each matched route's `scene`/`presentation` staticData in that order through
 * `setSceneState` lets a child route's declaration override its parent's. `matches` gets a fresh
 * reference on every render regardless of whether its staticData changed, so a ref tracks the
 * last-applied key and skips the store update when it hasn't.
 */
export function SceneStateSync(): null {
  const matches = useMatches();

  const contributionsKey = matches
    .map((match) => `${match.staticData.scene ?? ''}:${match.staticData.presentation ?? ''}`)
    .join('|');

  const lastContributionsKey = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (lastContributionsKey.current === contributionsKey) {
      return;
    }

    lastContributionsKey.current = contributionsKey;

    setSceneState(matches.map((match) => match.staticData));
  }, [contributionsKey, matches]);

  return null;
}
