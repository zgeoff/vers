import { css } from '@vers/styled-system/css';

const grid = css({
  display: 'grid',
  gap: '2',
  gridTemplateColumns: '[repeat(auto-fill,minmax(4rem,1fr))]',
});

const cell = css({
  aspectRatio: '[1]',
  backgroundColor: 'bg.panel',
  borderColor: 'border',
  borderRadius: 'sm',
  borderWidth: '[1px]',
});

export function PlaceholderGrid(props: Readonly<{ count: number }>) {
  return (
    <div className={grid}>
      {Array.from({ length: props.count }, (_, index) => `cell-${index}`).map((key) => (
        <span key={key} className={cell} />
      ))}
    </div>
  );
}
