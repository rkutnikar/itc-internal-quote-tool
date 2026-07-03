"use client";

import type { PriceSheet, Tier } from "@/lib/pricing";

interface PriceSliderProps {
  sheet: PriceSheet;
  roundTo: number;
  value: number;
  onChange: (value: number) => void;
  budgetPerMonth: number | null;
  formatter: Intl.NumberFormat;
}

const TIER_LABEL: Record<Tier, string> = {
  good: "Good",
  better: "Better",
  best: "Best",
};

export default function PriceSlider({
  sheet,
  roundTo,
  value,
  onChange,
  budgetPerMonth,
  formatter,
}: PriceSliderProps) {
  const { sliderMin, sliderMax } = sheet;
  const range = Math.max(sliderMax - sliderMin, 1);
  const pct = (v: number) => ((v - sliderMin) / range) * 100;

  const showBudgetMarker =
    budgetPerMonth !== null && budgetPerMonth >= sliderMin && budgetPerMonth <= sliderMax;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative pt-6 pb-8">
        {/* Tick marks for each tier */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-6">
          {(["good", "better", "best"] as const).map((tier) => (
            <div
              key={tier}
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1"
              style={{ left: `${pct(sheet.tiers[tier].monthly)}%` }}
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted">
                {TIER_LABEL[tier]}
              </span>
              <span className="h-2 w-px bg-border" />
            </div>
          ))}
        </div>

        {showBudgetMarker && (
          <div
            className="pointer-events-none absolute top-6 z-10 -translate-x-1/2"
            style={{ left: `${pct(budgetPerMonth!)}%` }}
            title={`Budget: ${formatter.format(budgetPerMonth!)}`}
          >
            <div className="h-4 w-0.5 bg-warning" />
          </div>
        )}

        <input
          type="range"
          aria-label="Monthly rate"
          min={sliderMin}
          max={sliderMax}
          step={roundTo}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="price-range-input relative z-20 w-full"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span className="tnum">Minimum bill {formatter.format(sheet.minBill)}</span>
        <span className="tnum">{formatter.format(sheet.sliderMax)}</span>
      </div>
    </div>
  );
}
