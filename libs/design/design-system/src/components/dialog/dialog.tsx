import { Dialog as ArkDialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { sva } from '@vers/styled-system/css';
import * as React from 'react';
import { Button } from '../button/button';
import { Heading } from '../heading/heading';

interface Props {
  children: React.ReactNode;

  /**
   * Label for the built-in close trigger. Default "Close".
   */
  closeLabel?: string;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  title: string;
}

const dialogRecipe = sva({
  base: {
    backdrop: {
      backgroundColor: '[rgba(0, 0, 0, 0.6)]',
      inset: '0',
      position: 'fixed',
    },
    content: {
      backgroundColor: 'bg.panelElevated',
      borderColor: 'border.strong',
      borderWidth: '[1px]',
      display: 'flex',
      flexFlow: 'column',
      gap: '4',
      maxWidth: '96',
      padding: '6',
      width: 'full',
    },
    positioner: {
      alignItems: 'center',
      display: 'flex',
      inset: '0',
      justifyContent: 'center',
      padding: '4',
      position: 'fixed',
    },
  },
  slots: ['backdrop', 'content', 'positioner'],
});

/**
 * Modal dialog over the Ark UI primitive: focus is trapped while open, and escape, the backdrop,
 * and the built-in close trigger all report through `onOpenChange` — the open state itself is the
 * caller's.
 */
export function Dialog(props: Readonly<Props>) {
  const styles = dialogRecipe();

  return (
    <ArkDialog.Root
      onOpenChange={(details) => props.onOpenChange?.(details.open)}
      open={props.open}
    >
      <Portal>
        <ArkDialog.Backdrop className={styles.backdrop} />
        <ArkDialog.Positioner className={styles.positioner}>
          <ArkDialog.Content className={styles.content}>
            <ArkDialog.Title asChild>
              <Heading level={2}>{props.title}</Heading>
            </ArkDialog.Title>
            {props.children}
            <ArkDialog.CloseTrigger asChild>
              <Button type="button">{props.closeLabel ?? 'Close'}</Button>
            </ArkDialog.CloseTrigger>
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
}
