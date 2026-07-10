import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { registerSatellite } from '@vers/game-rendering';
import { SatelliteStack } from './satellite-stack';

test('it renders every registered satellite inside its fixed card stack', () => {
  registerSatellite('avatar-viewer', { element: <span>viewer content</span>, keepAlive: false });

  const rendered = render(<SatelliteStack />);

  expect(rendered.getByText('viewer content')).toBeInTheDocument();
});
