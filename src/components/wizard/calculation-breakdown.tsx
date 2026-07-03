"use client";

import { useState } from "react";
import type { PriceSheet, Tier } from "@/lib/pricing";

const TIER_LABEL: Record<Tier, string> = {
  good: "Good",
  better: "Better",
  best: "Best",
};

interface CalculationBreakdownProps {
  sheet: PriceSheet;
  tierMultipliers: { good: number; better: number; best: number };
  roundTo: number;
  formatter: Intl.NumberFormat;
  selectedTier: Tier | "custom";
}

export default function CalculationBreakdown({
  sheet,
  tierMultipliers,
  roundTo,
  formatter,
  selectedTier,
}: CalculationBreakdownProps) {
  const [open, setOpen] = useState(false);
  const effectiveTier: Tier = selectedTier === "custom" ? "better" : selectedTier;

  return (
    <div className="rounded-sm border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium text-ink transition hover:text-accent"
      >
        How was this calculated?
        <span aria-hidden="true" className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-4 text-sm">
          <Row label="Monthly cost" value={formatter.format(sheet.monthlyCost)} />
          <Row
            label="+ Experience adjustment"
            value={`${sheet.adjustments.experiencePct >= 0 ? "+" : ""}${sheet.adjustments.experiencePct}%`}
          />
          <Row
            label="+ Certification adjustment"
            value={`${sheet.adjustments.certificationPct >= 0 ? "+" : ""}${sheet.adjustments.certificationPct}%`}
          />
          <Row
            label="+ Skill type adjustment"
            value={`${sheet.adjustments.skillPct >= 0 ? "+" : ""}${sheet.adjustments.skillPct}%`}
          />
          <Row label="= Adjusted cost" value={formatter.format(sheet.adjustedCost)} emphasize />
          <Row
            label={`× Tier multiplier (${TIER_LABEL[effectiveTier]})`}
            value={`×${tierMultipliers[effectiveTier]}`}
          />
          <Row label="− Priority discount" value={`−${sheet.discountPct}%`} />
          <Row label="Rounded to" value={`nearest ${formatter.format(roundTo)}`} />
          <Row
            label="Minimum bill (floor)"
            value={formatter.format(sheet.minBill)}
            hint="Adjusted cost × min margin multiplier — discounts never cut below this."
          />
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  emphasize,
  hint,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className={emphasize ? "font-medium text-ink" : "text-muted"}>{label}</span>
        <span className={`tnum ${emphasize ? "font-semibold text-ink" : "text-ink"}`}>{value}</span>
      </div>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}
