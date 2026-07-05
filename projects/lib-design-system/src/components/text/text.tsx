import * as React from 'react';
import type { RecipeVariantProps } from '@vers/styled-system/css';
import { cva, cx } from '@vers/styled-system/css';
import type { PolymorphicComponentProps } from '../../types';

export type TextProps<C extends React.ElementType = 'p'> = RecipeVariantProps<
  typeof text
> & {
  as?: C;
  children: React.ReactNode;
  className?: string;
};

const text = cva({
  base: {
    //
  },
  variants: {
    align: {
      center: {
        textAlign: 'center',
      },
      left: {
        textAlign: 'left',
      },
      right: {
        textAlign: 'right',
      },
    },
    bold: {
      true: {
        fontWeight: 'bold',
      },
    },
  },
});

export function Text<C extends React.ElementType = 'p'>(
  props: PolymorphicComponentProps<C, TextProps>,
) {
  const { align, as, bold, className, ...restProps } = props;

  const Element = as ?? 'p';

  return (
    <Element {...restProps} className={cx(text({ align, bold }), className)} />
  );
}
