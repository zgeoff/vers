import { useRouter } from '@tanstack/react-router';
import { Sheet } from '@vers/design-system';
import type { ReactNode } from 'react';

/**
 * Where a dismissed ambient sheet lands: the region map is the canvas home behind every sheet until
 * scene-aware return is wired up.
 */
const SHEET_HOME = '/explore' as const;

/**
 * Hosts an ambient-presentation route as a bottom sheet over the dimmed canvas. Escape, the
 * backdrop, and the close control all dismiss to the canvas home; the parent renders this only
 * while the active route is ambient, so the sheet stays open for its lifetime.
 */
export function AmbientSheet(props: Readonly<{ children: ReactNode }>) {
  const router = useRouter();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      void router.navigate({ to: SHEET_HOME });
    }
  };

  return (
    <Sheet label="Game panel" onOpenChange={handleOpenChange} open>
      {props.children}
    </Sheet>
  );
}
