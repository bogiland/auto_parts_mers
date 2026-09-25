import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface SectionHeaderProps {
  title: string;
  href?: string;
  linkText?: string;
}

export function SectionHeader({ title, href, linkText }: SectionHeaderProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 mb-4">
      <h2 className="text-block font-bold">{title}</h2>
      {href && linkText ? <Link className="text-body text-ink-2 hover:text-accent inline-flex items-center gap-2 shrink-0" href={href}>{linkText}<ArrowRight aria-hidden="true" size={16} /></Link> : null}
    </div>
  );
}
