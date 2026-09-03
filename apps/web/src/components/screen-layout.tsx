import { Heading } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import type { ReactNode } from 'react';

const layout = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
  marginX: 'auto',
  maxWidth: 'contentMax',
  minHeight: '0',
  padding: '6',
  width: 'full',
});

export function ScreenLayout(props: Readonly<{ children: ReactNode; title: string }>) {
  return (
    <main className={layout}>
      <Heading level={1}>{props.title}</Heading>
      {props.children}
    </main>
  );
}
