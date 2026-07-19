import { useRouter } from '@tanstack/react-router';
import { Icon } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import type { ReactNode } from 'react';

/**
 * Where a dismissed ambient sheet lands: the region map is the canvas home behind every sheet until
 * scene-aware return is wired up.
 */
const SHEET_HOME = '/explore' as const;

const scrim = css({
  animationDuration: 'normal',
  animationName: '[fadeIn]',
  animationTimingFunction: 'default',
  backgroundColor: '[rgba(2, 4, 10, 0.6)]',
  border: '[none]',
  cursor: '[pointer]',
  inset: '0',
  position: 'fixed',
  zIndex: '[8]',
});

const sheet = css({
  animationDuration: 'normal',
  animationName: '[slideInFromBottom]',
  animationTimingFunction: 'default',
  backgroundColor: 'bg.panelElevated',
  borderColor: 'border',
  borderTopRadius: 'xl',
  borderWidth: '[1px]',
  bottom: '0',
  display: 'flex',
  flexDirection: 'column',
  left: '[4%]',
  overflowY: 'auto',
  position: 'fixed',
  right: '[4%]',
  top: '[7%]',
  zIndex: '[9]',
});

const closeButton = css({
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

/**
 * Hosts an ambient-presentation route as a bottom sheet over the dimmed canvas. The scrim and the
 * close control both dismiss to the canvas home; re-tapping the active rail item dismisses too.
 */
export function AmbientSheet(props: Readonly<{ children: ReactNode }>) {
  const router = useRouter();

  const handleClose = () => {
    void router.navigate({ to: SHEET_HOME });
  };

  return (
    <>
      <button aria-label="Close" className={scrim} onClick={handleClose} type="button" />
      <section className={sheet}>
        <button aria-label="Close" className={closeButton} onClick={handleClose} type="button">
          <Icon.Close />
        </button>
        {props.children}
      </section>
    </>
  );
}
