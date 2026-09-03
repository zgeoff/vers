import { useRouter } from '@tanstack/react-router';
import { Sheet } from '@vers/design-system';
import type { ReactNode } from 'react';

const SHEET_HOME = '/explore' as const;

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
