import { expect, test } from 'bun:test';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { SatelliteHost } from '@vers/game-rendering';
import { buildQueryClient } from '../../lib/query/build-query-client';
import { AvatarPanel } from './avatar-panel';

function renderPanel(content: React.ReactNode) {
  const queryClient = buildQueryClient();

  return render(
    <QueryClientProvider client={queryClient}>
      <AvatarPanel Content={content} />
    </QueryClientProvider>,
  );
}

test('it renders the loader-provided content', () => {
  const rendered = renderPanel(<p>avatar content</p>);

  expect(rendered.getByText('avatar content')).toBeInTheDocument();
});

test('it registers the avatar satellite viewer while the panel is mounted', () => {
  const queryClient = buildQueryClient();

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AvatarPanel Content={<p>avatar content</p>} />
      <SatelliteHost />
    </QueryClientProvider>,
  );

  expect(rendered.getByTestId('avatar-viewer-stub')).toBeInTheDocument();
});

test('it removes the avatar satellite viewer once the panel unmounts', () => {
  const queryClient = buildQueryClient();

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <AvatarPanel Content={<p>avatar content</p>} />
      <SatelliteHost />
    </QueryClientProvider>,
  );

  rendered.rerender(
    <QueryClientProvider client={queryClient}>
      <SatelliteHost />
    </QueryClientProvider>,
  );

  expect(rendered.queryByTestId('avatar-viewer-stub')).not.toBeInTheDocument();
});
