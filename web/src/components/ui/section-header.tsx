import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SectionTitle } from "@/components/ui/SectionTitle";

interface SectionHeaderProps {
  title: string;
  href?: string;
  linkText?: string;
}

export function SectionHeader({ title, href, linkText }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-4">
      <SectionTitle className="mb-0">{title}</SectionTitle>
      {href && linkText ? <Link className="text-body text-ink-2 hover:text-accent inline-flex items-center gap-2 shrink-0" href={href}>{linkText}<ArrowRight aria-hidden="true" size={16} /></Link> : null}
    </div>
  );
}
