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

export function AuthLayout(props: Readonly<{ children: ReactNode }>) {
  return <main className={layout}>{props.children}</main>;
}
