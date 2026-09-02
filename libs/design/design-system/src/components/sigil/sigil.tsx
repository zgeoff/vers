import { cva, cx } from '@vers/styled-system/css';

export type SigilTint = 'artisan' | 'enhanced' | 'normal' | 'self' | 'unique' | 'world';

const sigil = cva({
  base: {
    display: 'block',
  },
  defaultVariants: { tint: 'world' },
  variants: {
    tint: {
      artisan: { color: 'accent.rarity.artisan' },
      enhanced: { color: 'accent.rarity.enhanced' },
      normal: { color: 'accent.rarity.normal' },
      self: { color: 'accent.self' },
      unique: { color: 'accent.rarity.unique' },
      world: { color: 'accent.world' },
    },
  },
});

interface SigilProps {
  readonly className?: string;
  readonly size?: number;
  readonly tint?: SigilTint;
}

export function Sigil(props: Readonly<SigilProps>) {
  const size = props.size ?? 40;

  return (
    <svg
      className={cx(
        sigil({ ...(props.tint !== undefined && { tint: props.tint }) }),
        props.className,
      )}
      fill="none"
      height={size}
      viewBox="0 0 60 60"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <polygon
        fill="currentColor"
        fillOpacity="0.1"
        points="30,4 52,17 52,43 30,56 8,43 8,17"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <polygon
        points="30,14 42,22 42,38 30,46 18,38 18,22"
        stroke="currentColor"
        strokeOpacity="0.7"
        strokeWidth="1"
      />
      <path
        d="M30 14 L30 46 M18 22 L42 38 M42 22 L18 38"
        stroke="currentColor"
        strokeOpacity="0.32"
        strokeWidth="0.75"
      />
      <path d="M30 20 L38 30 L30 40 L22 30 Z" fill="currentColor" fillOpacity="0.55" />
    </svg>
  );
}
