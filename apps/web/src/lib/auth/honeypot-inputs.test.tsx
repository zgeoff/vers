import { expect, test } from 'bun:test';
import invariant from 'tiny-invariant';
import { render } from '../../test-utils/render';
import { HoneypotInputs } from './honeypot-inputs';

test('it carries the given valid-from timestamp verbatim', () => {
  const rendered = render(<HoneypotInputs validFrom="1700000000000" />);
  const validFrom = rendered.container.querySelector('input[name="from__confirm"]');

  invariant(validFrom, 'expected the valid-from field to render');

  expect(validFrom).toHaveValue('1700000000000');
});

test('it re-renders without restamping the valid-from timestamp', () => {
  const rendered = render(<HoneypotInputs validFrom="1700000000000" />);

  rendered.refresh();

  const validFrom = rendered.container.querySelector('input[name="from__confirm"]');

  invariant(validFrom, 'expected the valid-from field to render');

  expect(validFrom).toHaveValue('1700000000000');
});

test('it renders the honeypot field empty', () => {
  const rendered = render(<HoneypotInputs validFrom="1700000000000" />);
  const honeypot = rendered.container.querySelector('input[name="name__confirm"]');

  invariant(honeypot, 'expected the honeypot field to render');

  expect(honeypot).toHaveValue('');
});
