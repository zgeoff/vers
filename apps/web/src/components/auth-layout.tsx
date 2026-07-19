import { css } from '@vers/styled-system/css';
import type { ReactNode } from 'react';

const layout = css({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  gap: '6',
  marginX: 'auto',
  maxWidth: 'md',
  paddingX: '6',
  paddingY: '10',
  width: 'full',
});

/**
 * The shared frame for pre-auth and account pages: a horizontally centred, width-bounded column.
 */
export function AuthLayout(props: Readonly<{ children: ReactNode }>) {
  return <main className={layout}>{props.children}</main>;
}
