import type { RecipeVariantProps, Styles } from '@vers/styled-system/css';
import { cva, cx } from '@vers/styled-system/css';
import * as React from 'react';
import type { PolymorphicComponentProps } from '../../types';

const button = cva({
  base: {
    _disabled: {
      _hover: {
        cursor: '[not-allowed]',
      },
      cursor: '[not-allowed]',
    },
    _hover: {
      cursor: '[pointer]',
    },
    alignItems: 'center',
    borderWidth: '[1px]',
    display: 'flex',
    fontWeight: 'semibold',
    justifyContent: 'center',
    lineHeight: 'none',
    overflow: 'hidden',
    position: 'relative',
    textAlign: 'center',
    userSelect: 'none',
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
  variants: {
    fullWidth: {
      true: {
        width: 'full',
      },
    },
    size: {
      lg: {
        fontSize: 'lg',
        height: '14',
        paddingX: '8',
        paddingY: '4',
      },
      md: {
        fontSize: 'md',
        height: '10',
        paddingX: '6',
        paddingY: '3',
      },
      sm: {
        fontSize: 'sm',
        height: '8',
        paddingX: '4',
        paddingY: '2',
      },
    },
    variant: {
      default: {
        _disabled: {
          _hover: {
            borderColor: 'border.subtle',
          },
          borderColor: 'border.subtle',
          color: 'text.faint',
        },
        _hover: {
          borderColor: 'border.strong',
        },
        background: 'bg.panelElevated',
        borderColor: 'border',
        color: 'text.primary',
      },
      link: {
        _hover: {
          textDecoration: 'underline',
        },
        borderWidth: '[0]',
        color: 'text.primary',
        fontWeight: 'normal',
        padding: '0',
      },
      primary: {
        _disabled: {
          _hover: {
            borderColor: 'border.subtle',
          },
          borderColor: 'border.subtle',
          color: 'text.faint',
        },
        _hover: {
          borderColor: 'border.strong',
        },
        background: 'bg.panelElevated',
        borderColor: 'border',
        color: 'text.primary',
      },
      secondary: {
        _disabled: {
          _hover: {
            borderColor: 'border.subtle',
          },
          borderColor: 'border.subtle',
          color: 'text.faint',
        },
        _hover: {
          borderColor: 'border.strong',
        },
        background: 'bg.panelElevated',
        borderColor: 'border',
        color: 'text.primary',
      },
      tertiary: {
        _disabled: {
          _hover: {
            borderColor: 'border.subtle',
          },
          borderColor: 'border.subtle',
          color: 'text.faint',
        },
        _hover: {
          borderColor: 'border.strong',
        },
        background: 'bg.panelElevated',
        borderColor: 'border',
        color: 'text.primary',
      },
      transparent: {
        _hover: {
          background: 'transparent',
        },
        background: 'transparent',
        borderWidth: '[0]',
      },
    },
  },
});

type ButtonProps<C extends React.ElementType = 'button'> = RecipeVariantProps<typeof button> & {
  as?: C;
  children: React.ReactNode;
  css?: Styles;
};

export type Props<C extends React.ElementType = 'button'> = PolymorphicComponentProps<
  C,
  ButtonProps
>;

export function Button<C extends React.ElementType>(props: Readonly<Props<C>>) {
  const { as, className, fullWidth, size, variant, ...restProps } = props;
  const Element = as ?? 'button';

  return (
    <Element
      {...restProps}
      className={cx(
        button({
          ...(fullWidth !== undefined && { fullWidth }),
          ...(size !== undefined && { size }),
          ...(variant !== undefined && { variant }),
        }),
        className,
      )}
    />
  );
}
