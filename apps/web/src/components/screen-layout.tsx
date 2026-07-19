import { Heading } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import type { ReactNode } from 'react';

const layout = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '5',
  minHeight: '0',
  padding: '6',
});

/**
 * The shared frame for a game screen: a titled, padded column that fills its host — the ambient
 * sheet for meta screens, the viewport for focus scenes.
 */
export function ScreenLayout(props: Readonly<{ children: ReactNode; title: string }>) {
  return (
    <main className={layout}>
      <Heading level={1}>{props.title}</Heading>
      {props.children}
    </main>
  );
}
