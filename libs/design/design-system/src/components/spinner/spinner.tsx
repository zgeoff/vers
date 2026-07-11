import { css, cva } from '@vers/styled-system/css';
import type { RecipeVariantProps } from '@vers/styled-system/css';

const wrapper = cva({
  base: {
    display: 'block',
  },
  defaultVariants: {
    size: 'md',
  },
  variants: {
    size: {
      lg: { height: '16', width: '16' },
      md: { height: '8', width: '8' },
      sm: { height: '4', width: '4' },
    },
  },
});

const container = css({
  animation: 'spin',
  animationDuration: 'slowest',
  animationIterationCount: 'infinite',
  animationTimingFunction: 'linear',
  color: 'neutral.200',
});

const circle = css({
  opacity: '[0.4]',
});

const spinner = css({
  opacity: '[1]',
});

type Props = RecipeVariantProps<typeof wrapper> & {
  className?: string;
  color?: string;
};

export function Spinner(props: Readonly<Props>) {
  return (
    <output className={wrapper({ ...(props.size !== undefined && { size: props.size }) })}>
      <svg className={container} fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle className={circle} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path
          className={spinner}
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          fill="currentColor"
        />
      </svg>
    </output>
  );
}
