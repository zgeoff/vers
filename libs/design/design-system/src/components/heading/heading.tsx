import { cva, cx } from '@vers/styled-system/css';
import * as React from 'react';

interface Props {
  children: React.ReactNode;
  className?: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
}

const heading = cva({
  base: {
    color: 'slate.200',
    fontFamily: 'display',
    fontWeight: 'semibold',
  },
  variants: {
    level: {
      1: { fontSize: '3xl', lineHeight: 'relaxed', marginBottom: '3' },
      2: { fontSize: '2xl', lineHeight: 'relaxed', marginBottom: '2' },
      3: { fontSize: 'xl', lineHeight: 'relaxed', marginBottom: '2' },
      4: { fontSize: 'lg', lineHeight: 'relaxed', marginBottom: '1' },
      5: { fontSize: 'md', lineHeight: 'relaxed', marginBottom: '1' },
      6: { fontSize: 'sm', lineHeight: 'relaxed', marginBottom: '1' },
    },
  },
});

export function Heading(props: Readonly<Props>) {
  const Element = `h${props.level}` as const;

  return (
    <Element className={cx(heading({ level: props.level }), props.className)}>
      {props.children}
    </Element>
  );
}
