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
  backgroundColor: 'bg.panelElevated',
  borderColor: 'border',
  borderWidth: '[1px]',
  marginBottom: '2',
});

const lifeBarFill = css({
  backgroundColor: 'accent.enemy',
  height: '2',
  width: 'full',
});

interface LifeBarProps {
  life: number;
  maxLife: number;
}

export function LifeBar(props: Readonly<LifeBarProps>) {
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
