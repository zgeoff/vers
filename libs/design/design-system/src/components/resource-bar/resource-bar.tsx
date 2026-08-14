import { css, cva, cx } from '@vers/styled-system/css';
import type { ReactNode } from 'react';

/**
 * The palette a bar or layer paints its fill in. Names map to `accent.*` semantic tokens, so a
 * re-skin moves the colour without touching callers.
 */
export type ResourceBarTint =
  | 'aether'
  | 'artisan'
  | 'barrier'
  | 'enhanced'
  | 'normal'
  | 'self'
  | 'unique'
  | 'world';

const track = cva({
  base: {
    backgroundColor: 'bg.panelElevated',
    borderColor: 'border',
    borderRadius: '[999px]',
    borderWidth: '[1px]',
    overflow: 'hidden',
    position: 'relative',
    width: 'full',
  },
  defaultVariants: { size: 'md' },
  variants: {
    size: {
      md: { height: '[14px]' },
      sm: { height: '[4px]' },
    },
  },
});

const fill = cva({
  base: {
    height: 'full',
    left: '[0]',
    position: 'absolute',
    top: '[0]',
    // A vital only steps on discrete combat events, so easing the width change reads as the pool
    // draining rather than teleporting.
    transition: '[width 120ms linear]',
  },
  variants: {
    tint: {
      aether: { backgroundColor: 'accent.aether' },
      artisan: { backgroundColor: 'accent.rarity.artisan' },
      barrier: { backgroundColor: 'accent.barrier' },
      enhanced: { backgroundColor: 'accent.rarity.enhanced' },
      normal: { backgroundColor: 'accent.rarity.normal' },
      self: { backgroundColor: 'accent.self' },
      unique: { backgroundColor: 'accent.rarity.unique' },
      world: { backgroundColor: 'accent.world' },
    },
  },
});

const header = css({
  alignItems: 'baseline',
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '1',
});

const labelText = css({
  color: 'text.muted',
  fontFamily: 'mono',
  fontSize: '2xs',
  fontWeight: 'bold',
  letterSpacing: '[0.1em]',
});

const valueText = css({
  color: 'text.primary',
  fontFamily: 'display',
  fontSize: '2xs',
  fontWeight: 'bold',
});

interface ResourceBarProps {
  readonly children?: ReactNode;
  readonly className?: string;
  readonly label?: string;
  readonly max: number;
  readonly size?: 'md' | 'sm';
  readonly tint: ResourceBarTint;
  readonly value: number;
  readonly valueLabel?: string;
}

/**
 * A layered vitals bar: the primary fill plus any `Overlay`/`Reserved` layers passed as children.
 * Enrich a bar by adding a layer, never a boolean prop; each layer is measured against the same
 * `max` the caller passes it.
 */
export function ResourceBar(props: Readonly<ResourceBarProps>) {
  const hasHeader = props.label !== undefined || props.valueLabel !== undefined;

  return (
    <div className={props.className}>
      {hasHeader ? (
        <div className={header}>
          <span className={labelText}>{props.label}</span>
          <span className={valueText}>{props.valueLabel}</span>
        </div>
      ) : null}
      <div className={track({ ...(props.size !== undefined && { size: props.size }) })}>
        <div
          className={fill({ tint: props.tint })}
          style={{ width: toWidth(props.value, props.max) }}
        />
        {props.children}
      </div>
    </div>
  );
}

const overlay = css({
  boxShadow: '[inset 0 0 0 1px rgba(255,255,255,0.25)]',
  height: 'full',
  left: '[0]',
  position: 'absolute',
  top: '[0]',
  zIndex: '[1]',
});

interface LayerProps {
  readonly max: number;
  readonly tint?: ResourceBarTint;
  readonly value: number;
}

/**
 * A translucent segment stacked over the primary fill from the left — a barrier or ward sitting on
 * top of the same track.
 */
function ResourceBarOverlay(props: Readonly<LayerProps>) {
  return (
    <div
      className={cx(overlay, fill({ tint: props.tint ?? 'barrier' }))}
      style={{ opacity: 0.55, width: toWidth(props.value, props.max) }}
    />
  );
}

const reserved = css({
  backgroundColor: '[rgba(120,132,158,0.22)]',
  bottom: '[0]',
  position: 'absolute',
  right: '[0]',
  top: '[0]',
  zIndex: '[1]',
});

/**
 * An unavailable slice anchored to the right end of the track — capacity held back from the pool.
 */
function ResourceBarReserved(props: Readonly<LayerProps>) {
  return <div className={reserved} style={{ width: toWidth(props.value, props.max) }} />;
}

ResourceBar.Overlay = ResourceBarOverlay;
ResourceBar.Reserved = ResourceBarReserved;

function toWidth(value: number, max: number): string {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;

  return `${pct}%`;
}
