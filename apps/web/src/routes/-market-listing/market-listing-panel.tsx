import { Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

interface MarketListingPanelProps {
  readonly listingID: string;
}

const panel = css({
  backgroundColor: 'bg.panelElevated',
  borderColor: 'border',
  borderWidth: '[1px]',
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  marginX: '6',
  marginBottom: '6',
  padding: '6',
});

export function MarketListingPanel(props: MarketListingPanelProps) {
  return (
    <section className={panel}>
      <Heading level={2}>Listing {props.listingID}</Heading>
      <Text>Full listing details are coming soon.</Text>
    </section>
  );
}
