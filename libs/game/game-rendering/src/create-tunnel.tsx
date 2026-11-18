import { Fragment, useEffect, useId } from 'react';
import type { ReactNode } from 'react';
import { create } from 'zustand';

interface TunnelState {
  readonly order: ReadonlyArray<string>;
  readonly entries: ReadonlyMap<string, ReactNode>;
}

interface TunnelInProps {
  readonly children: ReactNode;
}

export function createTunnel(): {
  readonly In: (props: Readonly<TunnelInProps>) => null;
  readonly Out: () => ReactNode;
} {
  const useTunnelStore = create<TunnelState>(() => ({
    order: [],
    entries: new Map(),
  }));

  return {
    In: (props: Readonly<TunnelInProps>): null => {
      const id = useId();

      useEffect(() => {
        useTunnelStore.setState((state) => ({
          order: state.order.includes(id) ? state.order : [...state.order, id],
          entries: new Map(state.entries).set(id, props.children),
        }));
      });

      // removal runs only on unmount; folding it into the effect above would move this entry to
      // the end of the order on every re-render
      useEffect(
        () => () => {
          useTunnelStore.setState((state) => {
            const entries = new Map(state.entries);

            entries.delete(id);

            return { order: state.order.filter((entryID) => entryID !== id), entries };
          });
        },
        [id],
      );

      return null;
    },
    Out: (): ReactNode => {
      const order = useTunnelStore((state) => state.order);
      const entries = useTunnelStore((state) => state.entries);

      if (order.length === 0) {
        return null;
      }

      return order.map((id) => <Fragment key={id}>{entries.get(id)}</Fragment>);
    },
  };
}
