import type { ReactNode } from "react";

interface IconActionProps {
  href: string;
  icon: ReactNode;
  label: string;
  badge?: number;
}

export function IconAction({ href, icon, label, badge }: IconActionProps) {
  return (
    <a className="icon-action" href={href} aria-label={label}>
      <span className="icon-action__icon">
        {icon}
        {badge ? <span className="icon-action__badge">{badge}</span> : null}
      </span>
      <span>{label}</span>
    </a>
  );
}
