import { css } from '@vers/styled-system/css';

const grid = css({ display: 'grid', gap: '2' });

const cell = css({
  aspectRatio: '[1]',
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: 'sm',
  borderWidth: '[1px]',
});

/**
 * A fixed grid of empty cells standing in for an item or slot layout.
 */
export function PlaceholderGrid(props: Readonly<{ columns: number; count: number }>) {
  return (
    <div
      className={grid}
      style={{ gridTemplateColumns: `repeat(${props.columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: props.count }, (_, index) => `cell-${index}`).map((key) => (
        <span key={key} className={cell} />
      ))}
    </div>
  );
}
