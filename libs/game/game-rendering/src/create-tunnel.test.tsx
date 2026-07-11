import { expect, test } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { createTunnel } from './create-tunnel';

interface UnmountSceneProps {
  readonly showIn: boolean;
  readonly tunnel: ReturnType<typeof createTunnel>;
}

function UnmountScene(props: Readonly<UnmountSceneProps>) {
  return (
    <>
      {props.showIn && (
        <props.tunnel.In>
          <span>hello</span>
        </props.tunnel.In>
      )}
      <props.tunnel.Out />
    </>
  );
}

interface LabelSceneProps {
  readonly label: string;
  readonly tunnel: ReturnType<typeof createTunnel>;
}

function LabelScene(props: Readonly<LabelSceneProps>) {
  return (
    <>
      <props.tunnel.In>
        <span>{props.label}</span>
      </props.tunnel.In>
      <props.tunnel.Out />
    </>
  );
}

test('it renders nothing out when no in is mounted', () => {
  const tunnel = createTunnel();
  const rendered = render(<tunnel.Out />);

  expect(rendered.container).toBeEmptyDOMElement();
});

test('it renders an in child through out', () => {
  const tunnel = createTunnel();

  render(
    <>
      <tunnel.In>
        <span>hello</span>
      </tunnel.In>
      <tunnel.Out />
    </>,
  );

  expect(screen.getByText('hello')).toBeInTheDocument();
});

test('it renders multiple ins through out in mount order', () => {
  const tunnel = createTunnel();

  const rendered = render(
    <>
      <tunnel.In>
        <span>first</span>
      </tunnel.In>
      <tunnel.In>
        <span>second</span>
      </tunnel.In>
      <tunnel.Out />
    </>,
  );

  expect(rendered.container.textContent).toBe('firstsecond');
});

test('it removes an in child from out on unmount', () => {
  const tunnel = createTunnel();
  const rendered = render(<UnmountScene showIn tunnel={tunnel} />);

  expect(screen.getByText('hello')).toBeInTheDocument();

  rendered.rerender(<UnmountScene showIn={false} tunnel={tunnel} />);

  expect(screen.queryByText('hello')).not.toBeInTheDocument();
});

test('it updates out when an in child changes on re-render', () => {
  const tunnel = createTunnel();
  const rendered = render(<LabelScene label="first" tunnel={tunnel} />);

  expect(screen.getByText('first')).toBeInTheDocument();

  rendered.rerender(<LabelScene label="second" tunnel={tunnel} />);

  expect(screen.queryByText('first')).not.toBeInTheDocument();
  expect(screen.getByText('second')).toBeInTheDocument();
});

test('it keeps two tunnels from the same factory independent', () => {
  const first = createTunnel();
  const second = createTunnel();

  render(
    <>
      <first.In>
        <span>only in first</span>
      </first.In>
      <second.Out />
    </>,
  );

  expect(screen.queryByText('only in first')).not.toBeInTheDocument();
});
