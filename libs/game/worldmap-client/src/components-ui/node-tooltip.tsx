import { useEventListener } from '@react-hookz/web';
import { Text } from '@vers/design-system';
import { useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useHoveredNode } from '../state/use-hovered-node';
import * as styles from './node-tooltip.styles';
import { Tooltip } from './tooltip';

interface NodeTooltipProps {
  className?: string;
}

const TOOLTIP_OFFSET = 10;

export function NodeTooltip(props: Readonly<NodeTooltipProps>) {
  const element = useRef<HTMLDivElement | null>(null);
  const node = useHoveredNode();
  const document = useDocument();

  useEventListener(document, 'mousemove', (event: MouseEvent) => {
    if (element.current) {
      const x = event.clientX + TOOLTIP_OFFSET;
      const y = event.clientY + TOOLTIP_OFFSET;

      element.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  });

  if (!node || !document) {
    return null;
  }

  return createPortal(
    <Tooltip
      ref={element}
      {...(props.className !== undefined && { className: props.className })}
      variant="default"
    >
      <Tooltip.Header>
        <Text className={styles.name}>Test World Map Node ({node?.id})</Text>
      </Tooltip.Header>
      <Tooltip.Content>
        <Text className={styles.difficulty}>
          Difficulty <strong>{node?.difficulty}</strong>
        </Text>
      </Tooltip.Content>
    </Tooltip>,
    document.body,
  );
}

function useDocument() {
  return useSyncExternalStore(
    subscribeToDocument,
    () => document,
    () => null,
  );
}

// the client's document never changes, so there is nothing to listen for
function subscribeToDocument(): () => void {
  return () => {};
}
