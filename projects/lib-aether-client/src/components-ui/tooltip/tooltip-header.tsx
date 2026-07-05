import { BackgroundPattern } from '@vers/design-system';
import { withContext } from './context';

interface TooltipHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function TooltipHeader(props: TooltipHeaderProps) {
  const { children, className, ...restProps } = props;

  return (
    <header className={className} {...restProps}>
      {children}
      <TooltipHeaderBackground />
    </header>
  );
}

const TooltipHeaderBackground = withContext(BackgroundPattern, 'headerBackground');
