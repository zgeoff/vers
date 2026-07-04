import * as React from 'react';
import { withContext, withProvider } from './context';
import { TooltipContent } from './tooltip-content';
import { TooltipHeader } from './tooltip-header';

interface TooltipProps {
  children: React.ReactNode;
  className?: string;
}

const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>((props, ref) => {
  const { children, className, ...restProps } = props;

  return (
    <div {...restProps} ref={ref} className={className} role="tooltip">
      {children}
    </div>
  );
});

Tooltip.displayName = 'Tooltip';

const CompoundTooltip = Object.assign(withProvider(Tooltip, 'root'), {
  Content: withContext(TooltipContent, 'content'),
  Header: withContext(TooltipHeader, 'header'),
});

export { CompoundTooltip as Tooltip };
