import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { registerSatellite } from './register-satellite';
import { SatelliteHost } from './satellite-host';

test('it renders nothing when no satellites are registered', () => {
  const rendered = render(<SatelliteHost />);

  expect(rendered.container).toBeEmptyDOMElement();
});

test('it renders every registered satellite element', () => {
  registerSatellite('avatar', { element: <span>avatar viewer</span>, keepAlive: false });
  registerSatellite('item', { element: <span>item inspector</span>, keepAlive: false });

  render(<SatelliteHost />);

  expect(screen.getByText('avatar viewer')).toBeInTheDocument();
  expect(screen.getByText('item inspector')).toBeInTheDocument();
});
