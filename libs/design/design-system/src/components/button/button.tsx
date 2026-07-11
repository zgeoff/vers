import type { RecipeVariantProps, Styles } from '@vers/styled-system/css';
import { cva, cx } from '@vers/styled-system/css';
import * as React from 'react';
import type { PolymorphicComponentProps } from '../../types';

const button = cva({
  base: {
    _active: {
      transform: 'translateY(1px)',
    },
    _disabled: {
      _active: {
        transform: 'none',
      },
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
    fontFamily: 'body',
    fontWeight: 'semibold',
    justifyContent: 'center',
    lineHeight: 'none',
    overflow: 'hidden',
    position: 'relative',
    rounded: 'sm',
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
            background: 'neutral.900',
          },
          background: 'neutral.900',
          borderColor: 'neutral.100/5',
          color: 'neutral.600',
        },
        _hover: {
          background: 'neutral.700',
        },
        background: 'neutral.800',
        borderColor: 'neutral.100/20',
        color: 'slate.100',
      },
      link: {
        _active: {
          transform: 'none',
        },
        _hover: {
          textDecoration: 'underline',
        },
        borderWidth: '[0]',
        color: 'sky.500',
        fontWeight: 'normal',
        padding: '0',
      },
      primary: {
        _disabled: {
          _hover: {
            background: 'sky.900',
          },
          background: 'sky.900',
          borderColor: 'neutral.100/5',
          color: 'neutral.900',
        },
        _hover: {
          background: 'sky.400',
        },
        background: 'sky.500',
        borderColor: 'neutral.100/20',
        color: 'neutral.900',
      },
      secondary: {
        _disabled: {
          _hover: {
            background: 'slate.800',
          },
          background: 'slate.800',
          borderColor: 'neutral.100/5',
          color: 'slate.600',
        },
        _hover: {
          background: 'slate.200',
        },
        background: 'slate.200',
        borderColor: 'neutral.100/20',
        color: 'slate.800',
      },
      tertiary: {
        _disabled: {
          _hover: {
            background: 'gold.900',
          },
          background: 'gold.900',
          borderColor: 'neutral.100/5',
          color: 'neutral.500',
        },
        _hover: {
          background: 'gold.400',
        },
        background: 'gold.500',
        borderColor: 'neutral.100/20',
        color: 'neutral.100',
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
