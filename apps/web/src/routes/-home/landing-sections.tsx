import { Heading } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { ScreenPanel } from '../../components/screen-panel';

const sections = css({ display: 'flex', flexDirection: 'column', gap: '8', marginTop: '8' });
const section = css({ display: 'flex', flexDirection: 'column', gap: '3' });

const triple = css({
  display: 'grid',
  gap: '4',
  gridTemplateColumns: { base: '1fr', md: 'repeat(3, 1fr)' },
});

const pair = css({
  display: 'grid',
  gap: '4',
  gridTemplateColumns: { base: '1fr', sm: 'repeat(2, 1fr)' },
});

export function LandingSections() {
  return (
    <div className={sections}>
      <section className={section}>
        <Heading level={2}>The world</Heading>
        <ScreenPanel label="Premise — world framing" />
      </section>
      <section className={section}>
        <Heading level={2}>What you&apos;ll do</Heading>
        <div className={triple}>
          <ScreenPanel label="Pillar one" />
          <ScreenPanel label="Pillar two" />
          <ScreenPanel label="Pillar three" />
        </div>
      </section>
      <section className={section}>
        <Heading level={2}>Screens</Heading>
        <div className={triple}>
          <ScreenPanel label="Screenshot" />
          <ScreenPanel label="Screenshot" />
          <ScreenPanel label="Screenshot" />
        </div>
      </section>
      <section className={section}>
        <Heading level={2}>Systems</Heading>
        <div className={pair}>
          <ScreenPanel label="System diagram" />
          <ScreenPanel label="Deeper systems" />
        </div>
      </section>
      <section className={section}>
        <Heading level={2}>Get started</Heading>
        <ScreenPanel label="Closing call to action" />
      </section>
    </div>
  );
}
