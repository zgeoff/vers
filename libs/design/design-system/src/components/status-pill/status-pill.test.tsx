import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { StatusPill } from './status-pill';

test('it abbreviates the effect name to a glyph and carries the full name for hover', () => {
  render(<StatusPill kind="buff" name="Fortified" />);

  expect(screen.getByText('FO')).toBeInTheDocument();
  expect(screen.getByTitle('Fortified')).toBeInTheDocument();
});

test('it shows a stack count only when stacks exceed one', () => {
  const rendered = render(<StatusPill kind="debuff" name="Chilled" stacks={1} />);

  expect(screen.queryByText('1')).not.toBeInTheDocument();

  rendered.rerender(<StatusPill kind="debuff" name="Chilled" stacks={3} />);

  expect(screen.getByText('3')).toBeInTheDocument();
});
