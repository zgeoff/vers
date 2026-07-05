import { Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';

const lifeBarContainer = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '2',
  position: 'relative',
  zIndex: '[1]',
});

const lifeLabel = css({
  fontSize: 'xs',
  lineHeight: 'tight',
  marginBottom: '0',
  textAlign: 'right',
});

const lifeBar = css({
  backgroundColor: 'gray.700',
  borderColor: 'gray.800',
  borderWidth: '[1px]',
  marginBottom: '2',
  rounded: 'xs',
});

const lifeBarFill = css({
  backgroundColor: 'red.500',
  height: '2',
  rounded: 'xs',
  transition: '[width]',
  transitionDuration: 'slowest',
  transitionTimingFunction: 'in-out',
  width: 'full',
});

interface LifeBarProps {
  life: number;
  maxLife: number;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function LifeBar(props: LifeBarProps) {
  const lifeWidth = (props.life / props.maxLife) * 100;

  return (
    <div className={lifeBarContainer}>
      <Text className={lifeLabel}>
        Life:{' '}
        <strong>
          {props.life} / {props.maxLife}
        </strong>
      </Text>
      <div className={lifeBar}>
        <div className={lifeBarFill} style={{ width: `${lifeWidth}%` }} />
      </div>
    </div>
  );
}
