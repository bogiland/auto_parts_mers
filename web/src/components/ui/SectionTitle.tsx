import type { ReactNode } from "react";

interface SectionTitleProps {
  children: ReactNode;
  className?: string;
  id?: string;
  mobileChildren?: ReactNode;
}

export function SectionTitle({ children, className = "", id, mobileChildren }: SectionTitleProps) {
  return <h2 className={`mb-4 text-block font-bold text-ink ${className}`.trim()} id={id}>{mobileChildren ? <><span className="md:hidden">{mobileChildren}</span><span className="hidden md:inline">{children}</span></> : children}</h2>;
}
