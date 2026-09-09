import { useSimulationSpeed } from '@vers/idle-client';
import { css } from '@vers/styled-system/css';

const badge = css({
  backgroundColor: 'bg.panel',
  borderColor: 'border.strong',
  borderRadius: 'full',
  borderWidth: '[1px]',
  color: 'text.primary',
  fontSize: 'sm',
  fontWeight: 'semibold',
  paddingBlock: '1',
  paddingInline: '3',
  pointerEvents: 'none',
  position: 'fixed',
  right: '4',
  top: '4',
  zIndex: '[20]',
});

export function QASpeedBadge() {
  const speed = useSimulationSpeed();

  if (speed <= 1) {
    return null;
  }

  return <output className={badge}>QA ×{speed}</output>;
}
