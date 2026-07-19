import { css } from '@vers/styled-system/css';
import type { ReactNode } from 'react';

const panel = css({
  borderColor: 'border',
  borderRadius: 'lg',
  borderWidth: '[1px]',
  display: 'flex',
  flexDirection: 'column',
  gap: '3',
  minHeight: '[6rem]',
  padding: '4',
});

const panelLabel = css({
  color: 'text.muted',
  fontSize: 'xs',
  letterSpacing: 'wider',
  textTransform: 'uppercase',
});

/**
 * A labelled section within a screen: the label names the area, children carry real content where a
 * screen has it and are absent where the area is still stubbed.
 */
export function ScreenPanel(props: Readonly<{ children?: ReactNode; label: string }>) {
  return (
    <section className={panel}>
      <span className={panelLabel}>{props.label}</span>
      {props.children}
    </section>
  );
}
