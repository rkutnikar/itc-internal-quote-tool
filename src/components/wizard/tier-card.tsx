import type { Tier, TierPrice } from "@/lib/pricing";

const TIER_LABEL: Record<Tier, string> = {
  good: "Good",
  better: "Better",
  best: "Best",
};

interface TierCardProps {
  tier: Tier;
  price: TierPrice;
  selected: boolean;
  onSelect: () => void;
  formatter: Intl.NumberFormat;
}

export default function TierCard({ tier, price, selected, onSelect, formatter }: TierCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`ledger-card flex flex-col gap-3 rounded-sm p-5 text-left transition duration-150 ${
        selected ? "ledger-card--selected" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {TIER_LABEL[tier]}
        </span>
        {price.clampedByFloor && (
          <span className="rounded-full bg-amber-light px-2 py-0.5 text-[11px] font-medium text-amber">
            floor
          </span>
        )}
      </div>

      <div>
        <p className="tnum font-display text-3xl font-semibold text-ink">
          {formatter.format(price.monthly)}
        </p>
        <p className="text-xs text-muted">per month</p>
      </div>

      <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted">Total contract</span>
          <span className="tnum font-medium text-ink">{formatter.format(price.total)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">Margin</span>
          <span className="tnum font-medium text-ink">{price.marginPct.toFixed(1)}%</span>
        </div>
      </div>

      <BudgetChip fit={price.budgetFit} />
    </button>
  );
}

function BudgetChip({ fit }: { fit: TierPrice["budgetFit"] }) {
  if (fit.kind === "no-budget") {
    return (
      <span className="w-fit rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-muted">
        no budget set
      </span>
    );
  }
  if (fit.kind === "fits") {
    return (
      <span className="tnum w-fit rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-medium text-accent">
        fits, {fit.headroomPct.toFixed(1)}% headroom
      </span>
    );
  }
  return (
    <span className="tnum w-fit rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-medium text-warning">
      over budget by {fit.overPct.toFixed(1)}%
    </span>
  );
}
