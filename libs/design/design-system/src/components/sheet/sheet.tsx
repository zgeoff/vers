import { css } from '@vers/styled-system/css';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '../icon/icon';

interface Props {
  children: ReactNode;
  closeLabel?: string;

  label: string;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
}

const scrim = css({
  backdropFilter: '[blur(8px)]',
  backgroundColor: '[rgba(2, 4, 10, 0.6)]',
  border: '[none]',
  cursor: '[pointer]',
  inset: '0',
  position: 'fixed',
  // its own transition group so it fades with the route transition instead of the frozen keyframe
  // snapping in at the end
  viewTransitionName: 'sheet-scrim',
  zIndex: '[8]',
});

// The native dialog's user-agent rules (fit-content sizing, auto margins, a max-width/height inset,
// and 1em padding) all fight a full-bleed sheet, so each is overridden back to the insets below.
const sheet = css({
  animationDuration: 'normal',
  animationName: '[slideInFromBottom]',
  animationTimingFunction: 'default',
  backgroundColor: 'bg.panelElevated',
  borderColor: 'border',
  borderTopRadius: 'xl',
  borderWidth: '[1px]',
  bottom: '0',
  color: 'text.primary',
  display: 'flex',
  flexDirection: 'column',
  height: 'auto',
  // reserve at least the width of an edge-anchored rail so the sheet never slips under it
  left: '[max(4%,6rem)]',
  margin: '0',
  maxHeight: '[none]',
  maxWidth: '[none]',
  overflowY: 'auto',
  padding: '0',
  position: 'fixed',
  right: '[max(4%,6rem)]',
  top: '[7%]',
  // the opaque frame is its own transition group so a swap can hold it steady while only the inner
  // content crossfades, keeping a solid panel in front of the live canvas throughout
  viewTransitionName: 'sheet',
  width: 'auto',
  zIndex: '[9]',
});

const sheetContent = css({
  display: 'flex',
  flexDirection: 'column',
  // crossfades on its own while the frame behind it holds opaque
  viewTransitionName: 'sheet-content',
});

const closeTrigger = css({
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
});

export function Sheet(props: Readonly<Props>) {
  const contentRef = useRef<HTMLDialogElement>(null);
  const open = props.open;
  const onOpenChange = props.onOpenChange;

  useEffect(() => {
    if (open) {
      contentRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (open && event.key === 'Escape') {
        onOpenChange?.(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onOpenChange, open]);

  if (!open) {
    return null;
  }

  return (
    <>
      <button
        aria-label="Dismiss"
        className={scrim}
        onClick={() => onOpenChange?.(false)}
        type="button"
      />
      <dialog aria-label={props.label} className={sheet} open ref={contentRef} tabIndex={-1}>
        <button
          aria-label={props.closeLabel ?? 'Close'}
          className={closeTrigger}
          onClick={() => onOpenChange?.(false)}
          type="button"
        >
          <Icon.Close />
        </button>
        <div className={sheetContent}>{props.children}</div>
      </dialog>
    </>
  );
}
