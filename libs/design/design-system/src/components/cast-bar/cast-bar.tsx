import { css, cva } from '@vers/styled-system/css';

export type CastBarTint = 'artisan' | 'enhanced' | 'normal' | 'self' | 'unique' | 'world';

const container = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
});

const heading = css({
  alignItems: 'center',
  display: 'flex',
  justifyContent: 'space-between',
});

const labelText = css({
  color: 'text.primary',
  fontFamily: 'display',
  fontSize: '2xs',
  fontWeight: 'semibold',
  letterSpacing: '[0.08em]',
});

const timeText = css({
  color: 'text.muted',
  fontFamily: 'mono',
  fontSize: '2xs',
});

const track = css({
  backgroundColor: 'bg.panelElevated',
  borderRadius: '[2px]',
  height: '[3px]',
  overflow: 'hidden',
  position: 'relative',
  width: 'full',
});

const fill = cva({
  base: {
    height: 'full',
  },
  variants: {
    tint: {
      artisan: { backgroundColor: 'accent.rarity.artisan' },
      enhanced: { backgroundColor: 'accent.rarity.enhanced' },
      normal: { backgroundColor: 'accent.rarity.normal' },
      self: { backgroundColor: 'accent.self' },
      unique: { backgroundColor: 'accent.rarity.unique' },
      world: { backgroundColor: 'accent.world' },
    },
  },
});

interface CastBarProps {
  readonly label: string;
  readonly progress: number;
  readonly tint?: CastBarTint;
  readonly time?: string;
}

export function CastBar(props: Readonly<CastBarProps>) {
  const pct = Math.max(0, Math.min(100, props.progress));

  return (
    <div className={container}>
      <div className={heading}>
        <span className={labelText}>{props.label}</span>
        {props.time === undefined ? null : <span className={timeText}>{props.time}</span>}
      </div>
      <div className={track}>
        <div className={fill({ tint: props.tint ?? 'world' })} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
