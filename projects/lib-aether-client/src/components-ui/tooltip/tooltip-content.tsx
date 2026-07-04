interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
}

export function TooltipContent(props: TooltipContentProps) {
  const { children, className, ...restProps } = props;

  return (
    <div className={className} {...restProps}>
      {children}
    </div>
  );
}
