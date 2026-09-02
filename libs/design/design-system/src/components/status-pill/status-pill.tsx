import { cva } from '@vers/styled-system/css';

export type StatusKind = 'buff' | 'debuff';

const pill = cva({
  base: {
    alignItems: 'center',
    borderRadius: '[6px]',
    borderWidth: '[1px]',
    color: 'text.primary',
    display: 'inline-flex',
    fontFamily: 'mono',
    fontSize: '2xs',
    fontWeight: 'bold',
    height: '[20px]',
    justifyContent: 'center',
    letterSpacing: '[0.02em]',
    position: 'relative',
    width: '[20px]',
  },
  variants: {
    kind: {
      buff: { backgroundColor: '[rgba(45,212,191,0.08)]', borderColor: 'accent.world' },
      debuff: { backgroundColor: '[rgba(251,113,133,0.08)]', borderColor: 'accent.enemy' },
    },
  },
});

const stackBadge = cva({
  base: {
    fontFamily: 'mono',
    fontSize: '[7.5px]',
    fontWeight: 'bold',
    lineHeight: '[1]',
    position: 'absolute',
    right: '[1px]',
    top: '[0px]',
  },
  variants: {
    kind: {
      buff: { color: 'accent.world' },
      debuff: { color: 'accent.enemy' },
    },
  },
});

interface StatusPillProps {
  readonly kind: StatusKind;
  readonly name: string;
  readonly stacks?: number;
}

export function StatusPill(props: Readonly<StatusPillProps>) {
  const stacked = props.stacks !== undefined && props.stacks > 1;

  return (
    <span className={pill({ kind: props.kind })} title={props.name}>
      {toGlyph(props.name)}
      {stacked ? <span className={stackBadge({ kind: props.kind })}>{props.stacks}</span> : null}
    </span>
  );
}

function toGlyph(name: string): string {
  return name.trim().slice(0, 2).toUpperCase();
}
