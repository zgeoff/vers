import { useMatches } from '@tanstack/react-router';
import { setSceneState } from '@vers/game-rendering';
import { useEffect, useRef } from 'react';

export function SceneStateSync(): null {
  const matches = useMatches();

  const contributionsKey = matches
    .map((match) => `${match.staticData.scene ?? ''}:${match.staticData.presentation ?? ''}`)
    .join('|');

  // `matches` is a fresh reference on every render even when no staticData changed, so the ref
  // tracks the last-applied key and skips the store update when it is unchanged
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
