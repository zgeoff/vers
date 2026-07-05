interface TooltipContentProps {
  children: React.ReactNode;
  className?: string;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function TooltipContent(props: TooltipContentProps) {
  const { children, className, ...restProps } = props;

  return (
    <div className={className} {...restProps}>
      {children}
    </div>
  );
}
