import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { SatelliteHost } from '@vers/game-rendering';
import { AvatarPanel } from './avatar-panel';

test('it renders the loader-provided content', () => {
  const rendered = render(<AvatarPanel Content={<p>avatar content</p>} />);

  expect(rendered.getByText('avatar content')).toBeInTheDocument();
});

test('it registers the avatar satellite viewer while the panel is mounted', () => {
  const rendered = render(
    <>
      <AvatarPanel Content={<p>avatar content</p>} />
      <SatelliteHost />
    </>,
  );

  expect(rendered.getByTestId('avatar-viewer-stub')).toBeInTheDocument();
});

test('it removes the avatar satellite viewer once the panel unmounts', () => {
  const rendered = render(
    <>
      <AvatarPanel Content={<p>avatar content</p>} />
      <SatelliteHost />
    </>,
  );

  rendered.rerender(<SatelliteHost />);

  expect(rendered.queryByTestId('avatar-viewer-stub')).not.toBeInTheDocument();
});
