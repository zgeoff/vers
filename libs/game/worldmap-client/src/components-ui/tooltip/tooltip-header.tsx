interface TooltipHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function TooltipHeader(props: Readonly<TooltipHeaderProps>) {
  const { children, className, ...restProps } = props;

  return (
    <header className={className} {...restProps}>
      {children}
    </header>
  );
}
