import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export default function SectionCard({ title, description, children }: SectionCardProps) {
  return (
    <section className="ledger-card rounded-sm p-6 sm:p-8">
      <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-6 flex flex-col gap-5">{children}</div>
    </section>
  );
}
