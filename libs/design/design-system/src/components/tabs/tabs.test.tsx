import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Tabs } from './tabs';

test('it shows the first tab by default', () => {
  render(
    <Tabs
      items={[
        { content: <p>first panel</p>, label: 'One', value: 'one' },
        { content: <p>second panel</p>, label: 'Two', value: 'two' },
      ]}
    />,
  );

  expect(screen.getByText('first panel')).toBeVisible();
});

test('it switches to the selected tab', async () => {
  const user = userEvent.setup();

  render(
    <Tabs
      items={[
        { content: <p>first panel</p>, label: 'One', value: 'one' },
        { content: <p>second panel</p>, label: 'Two', value: 'two' },
      ]}
    />,
  );

  await user.click(screen.getByRole('tab', { name: 'Two' }));

  expect(screen.getByText('second panel')).toBeVisible();
});

test('it honors a default value', () => {
  render(
    <Tabs
      defaultValue="two"
      items={[
        { content: <p>first panel</p>, label: 'One', value: 'one' },
        { content: <p>second panel</p>, label: 'Two', value: 'two' },
      ]}
    />,
  );

  expect(screen.getByText('second panel')).toBeVisible();
});
