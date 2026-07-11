import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ClassSelectionField } from './class-selection-field';

function ClassSelectionFieldHarness() {
  const [selected, setSelected] = useState<'brute' | 'scholar' | 'scoundrel' | undefined>(
    undefined,
  );

  return <ClassSelectionField selected={selected} onSelect={setSelected} />;
}

test('it renders every class as an unselected option with no description shown', () => {
  render(<ClassSelectionField selected={undefined} onSelect={() => {}} />);

  expect(screen.getByRole('radio', { name: 'Brute' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('radio', { name: 'Scoundrel' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.getByRole('radio', { name: 'Scholar' })).toHaveAttribute('aria-checked', 'false');
  expect(screen.queryByTestId('class-selection-description')).not.toBeInTheDocument();
});

test('it marks the selected class and shows its description', () => {
  render(<ClassSelectionField selected="brute" onSelect={() => {}} />);

  expect(screen.getByRole('radio', { name: 'Brute' })).toHaveAttribute('aria-checked', 'true');

  expect(screen.getByTestId('class-selection-description')).toHaveTextContent(
    'Only the strong remain.',
  );
});

test('it reports the clicked class to its caller', async () => {
  const user = userEvent.setup();

  render(<ClassSelectionFieldHarness />);

  await user.click(screen.getByRole('radio', { name: 'Scholar' }));

  expect(screen.getByRole('radio', { name: 'Scholar' })).toHaveAttribute('aria-checked', 'true');

  expect(screen.getByTestId('class-selection-description')).toHaveTextContent(
    'Vision shapes reality.',
  );
});

test('it shows a field error when given one', () => {
  render(
    <ClassSelectionField error="Class is required" selected={undefined} onSelect={() => {}} />,
  );

  expect(screen.getByRole('alert')).toHaveTextContent('Class is required');
});
