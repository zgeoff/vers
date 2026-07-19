import { Tabs as ArkTabs } from '@ark-ui/react/tabs';
import { sva } from '@vers/styled-system/css';
import type { ReactNode } from 'react';

interface TabItem {
  readonly content: ReactNode;
  readonly label: string;
  readonly value: string;
}

interface Props {
  defaultValue?: string;
  items: ReadonlyArray<TabItem>;
}

const tabsRecipe = sva({
  base: {
    content: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4',
      minHeight: '0',
      paddingTop: '4',
    },
    list: {
      borderBottomWidth: '[1px]',
      borderColor: 'border',
      display: 'flex',
      gap: '2',
    },
    root: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '0',
    },
    trigger: {
      borderBottomColor: '[transparent]',
      borderBottomWidth: '[2px]',
      color: 'text.muted',
      cursor: '[pointer]',
      fontWeight: 'medium',
      marginBottom: '[-1px]',
      paddingX: '3',
      paddingY: '2',
      transitionDuration: 'fast',
      transitionProperty: '[color, border-color]',
      _hover: { color: 'text.primary' },
      '&[data-selected]': { borderBottomColor: 'text.primary', color: 'text.primary' },
    },
  },
  slots: ['root', 'list', 'trigger', 'content'],
});

/**
 * Tabbed panel over the Ark UI primitive: each item renders a trigger and its content, the first
 * item selected unless `defaultValue` names another. Keyboard and roving focus come from Ark.
 */
export function Tabs(props: Readonly<Props>) {
  const styles = tabsRecipe();

  return (
    <ArkTabs.Root
      className={styles.root}
      defaultValue={props.defaultValue ?? props.items[0]?.value}
    >
      <ArkTabs.List className={styles.list}>
        {props.items.map((item) => (
          <ArkTabs.Trigger key={item.value} className={styles.trigger} value={item.value}>
            {item.label}
          </ArkTabs.Trigger>
        ))}
      </ArkTabs.List>
      {props.items.map((item) => (
        <ArkTabs.Content key={item.value} className={styles.content} value={item.value}>
          {item.content}
        </ArkTabs.Content>
      ))}
    </ArkTabs.Root>
  );
}
