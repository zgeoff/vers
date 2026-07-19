import type { RecipeVariantProps } from '@vers/styled-system/css';
import { cva, cx } from '@vers/styled-system/css';

type Props = RecipeVariantProps<typeof brand> & {
  className?: string;
};

const brand = cva({
  base: {
    color: 'text.heading',
    fontFamily: 'display',
    fontSize: '7xl',
    fontWeight: 'semibold',
  },
  defaultVariants: {
    size: 'lg',
  },
  variants: {
    size: {
      lg: {
        fontSize: '4xl',
      },
      md: {
        fontSize: '2xl',
      },
      sm: {
        fontSize: 'xl',
      },
      xl: {
        fontSize: '7xl',
      },
    },
  },
});

export function Brand(props: Readonly<Props>) {
  return (
    <h1
      className={cx(
        brand({ ...(props.size !== undefined && { size: props.size }) }),
        props.className,
      )}
    >
      vers
    </h1>
  );
}
