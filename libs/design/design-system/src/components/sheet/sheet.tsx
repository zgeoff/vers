import { Dialog as ArkDialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { sva } from '@vers/styled-system/css';
import type { ReactNode } from 'react';
import { Icon } from '../icon/icon';

interface Props {
  children: ReactNode;
  closeLabel?: string;

  /**
   * Accessible name for the dialog, announced to assistive tech in place of a visible title.
   */
  label: string;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
}

const sheetRecipe = sva({
  base: {
    backdrop: {
      backgroundColor: '[rgba(2, 4, 10, 0.6)]',
      inset: '0',
      position: 'fixed',
      zIndex: '[8]',
      '&[data-state=open]': {
        animationDuration: 'normal',
        animationName: '[fadeIn]',
        animationTimingFunction: 'default',
      },
    },
    closeTrigger: {
      alignItems: 'center',
      backgroundColor: 'bg.panel',
      borderColor: 'border',
      borderRadius: 'md',
      borderWidth: '[1px]',
      color: 'text.muted',
      cursor: '[pointer]',
      display: 'flex',
      justifyContent: 'center',
      padding: '2',
      position: 'absolute',
      right: '4',
      top: '4',
      zIndex: '[1]',
      _hover: { borderColor: 'border.strong', color: 'text.primary' },
    },
    content: {
      backgroundColor: 'bg.panelElevated',
      borderColor: 'border',
      borderTopRadius: 'xl',
      borderWidth: '[1px]',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      position: 'relative',
      width: 'full',
      '&[data-state=open]': {
        animationDuration: 'normal',
        animationName: '[slideInFromBottom]',
        animationTimingFunction: 'default',
      },
    },
    positioner: {
      alignItems: 'stretch',
      bottom: '0',
      display: 'flex',
      left: '[4%]',
      position: 'fixed',
      right: '[4%]',
      top: '[7%]',
      zIndex: '[9]',
    },
  },
  slots: ['backdrop', 'closeTrigger', 'content', 'positioner'],
});

/**
 * A bottom-anchored modal sheet over the Ark UI dialog primitive: focus is trapped while open, and
 * escape, the backdrop, and the close trigger all report through `onOpenChange` — the open state
 * itself is the caller's. The hosted content supplies its own heading, so the accessible name comes
 * from `label` rather than a visible title.
 */
export function Sheet(props: Readonly<Props>) {
  const styles = sheetRecipe();

  return (
    <ArkDialog.Root
      onOpenChange={(details) => props.onOpenChange?.(details.open)}
      open={props.open}
    >
      <Portal>
        <ArkDialog.Backdrop className={styles.backdrop} />
        <ArkDialog.Positioner className={styles.positioner}>
          <ArkDialog.Content aria-label={props.label} className={styles.content}>
            <ArkDialog.CloseTrigger
              aria-label={props.closeLabel ?? 'Close'}
              className={styles.closeTrigger}
            >
              <Icon.Close />
            </ArkDialog.CloseTrigger>
            {props.children}
          </ArkDialog.Content>
        </ArkDialog.Positioner>
      </Portal>
    </ArkDialog.Root>
  );
}
