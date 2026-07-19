import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './tabs';

const ITEMS = [
  { content: <p>first panel</p>, label: 'One', value: 'one' },
  { content: <p>second panel</p>, label: 'Two', value: 'two' },
];

test('it shows the first tab by default', () => {
  render(<Tabs items={ITEMS} />);
  expect(screen.getByText('first panel')).toBeVisible();
});

test('it switches to the selected tab', async () => {
  const user = userEvent.setup();

  render(<Tabs items={ITEMS} />);

  await user.click(screen.getByRole('tab', { name: 'Two' }));

  expect(screen.getByText('second panel')).toBeVisible();
});

test('it honors a default value', () => {
  render(<Tabs defaultValue="two" items={ITEMS} />);
  expect(screen.getByText('second panel')).toBeVisible();
});
