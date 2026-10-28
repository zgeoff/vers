import { useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';

// the build splits each route into a chunk that loads on the first visit, and the browser loads a
// font face only when text first needs it, so a screen or a weight the player has not seen yet
// fails once the network drops
export function GameAssetPreload() {
  const router = useRouter();

  useEffect(() => {
    for (const route of Object.values(router.routesById)) {
      if (route.id.startsWith('/_game/')) {
        runIgnoringRejection(Promise.resolve(router.loadRouteChunk(route)));
      }
    }

    // the font shorthand's sample text defaults to a space, so each load picks only the latin
    // subset of a face instead of every subset its stylesheet declares
    const fontShorthands = new Set<string>();

    document.fonts.forEach((face) => {
      fontShorthands.add(`${face.style} ${face.weight} 1em "${face.family.replaceAll('"', '')}"`);
    });

    for (const fontShorthand of fontShorthands) {
      runIgnoringRejection(document.fonts.load(fontShorthand));
    }
  }, [router]);

  return null;
}
