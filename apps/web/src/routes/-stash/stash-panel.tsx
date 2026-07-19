import { Tabs } from '@vers/design-system';
import { PlaceholderGrid } from '../../components/placeholder-grid';
import { ScreenLayout } from '../../components/screen-layout';
import { ScreenPanel } from '../../components/screen-panel';

export function StashPanel() {
  return (
    <ScreenLayout title="Stash">
      <Tabs
        items={[
          {
            content: <PlaceholderGrid columns={12} count={96} />,
            label: 'Tab 01',
            value: 'tab-01',
          },
          {
            content: <PlaceholderGrid columns={12} count={96} />,
            label: 'Tab 02',
            value: 'tab-02',
          },
          { content: <CurrencyTab />, label: 'Currency', value: 'currency' },
        ]}
      />
    </ScreenLayout>
  );
}

function CurrencyTab() {
  return (
    <>
      <ScreenPanel label="Currency">
        <PlaceholderGrid columns={8} count={24} />
      </ScreenPanel>
      <ScreenPanel label="Stacks" />
    </>
  );
}
