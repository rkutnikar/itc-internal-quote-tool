import type { PriorityKey } from "@/lib/pricing";

const PRIORITY_META: Record<PriorityKey, { label: string; className: string }> = {
  p1: { label: "P1", className: "bg-amber-light text-amber" },
  p2: { label: "P2", className: "bg-accent-light text-accent" },
  p3: { label: "P3", className: "bg-paper text-muted" },
};

export default function PriorityChip({ priorityKey }: { priorityKey: PriorityKey }) {
  const meta = PRIORITY_META[priorityKey];
  return (
    <span
      className={`inline-flex flex-none items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
