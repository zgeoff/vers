import { expect, test } from 'bun:test';
import { render } from '@testing-library/react';
import { SatelliteHost } from './satellite-host';
import { useSatellite } from './use-satellite';

interface OwnerProps {
  readonly keepAlive?: boolean;
}

function setupTest() {
  return {
    Owner: (props: Readonly<OwnerProps>) => {
      useSatellite('viewer', <span>viewer content</span>, props.keepAlive);

      return null;
    },
  };
}

test('it registers its satellite element while mounted', () => {
  const ctx = setupTest();

  const rendered = render(
    <>
      <ctx.Owner />
      <SatelliteHost />
    </>,
  );

  expect(rendered.getByText('viewer content')).toBeInTheDocument();
});

test('it removes a non-keepAlive satellite when its owner unmounts', () => {
  const ctx = setupTest();

  const rendered = render(
    <>
      <ctx.Owner />
      <SatelliteHost />
    </>,
  );

  rendered.rerender(<SatelliteHost />);

  expect(rendered.queryByText('viewer content')).not.toBeInTheDocument();
});

test('it leaves a keepAlive satellite registered after its owner unmounts', () => {
  const ctx = setupTest();

  const rendered = render(
    <>
      <ctx.Owner keepAlive />
      <SatelliteHost />
    </>,
  );

  rendered.rerender(<SatelliteHost />);

  expect(rendered.queryByText('viewer content')).toBeInTheDocument();
});
