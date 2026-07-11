import { expect, onTestFinished, test } from 'bun:test';
import { render } from '@testing-library/react';
import { registerSatellite, removeSatellite } from '@vers/game-rendering';
import { SatelliteStack } from './satellite-stack';

test('it renders every registered satellite inside its fixed card stack', () => {
  registerSatellite('avatar-viewer', { element: <span>viewer content</span>, keepAlive: false });

  onTestFinished(() => {
    removeSatellite('avatar-viewer');
  });

  const rendered = render(<SatelliteStack />);

  expect(rendered.getByText('viewer content')).toBeInTheDocument();
});
