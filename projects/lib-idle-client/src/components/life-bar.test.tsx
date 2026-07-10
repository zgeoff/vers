import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { LifeBar } from './life-bar';

test('it displays life percentage', () => {
  render(<LifeBar life={75} maxLife={100} />);

  const lifeText = screen.getByText('75 / 100');

  expect(lifeText).toBeInTheDocument();
});
