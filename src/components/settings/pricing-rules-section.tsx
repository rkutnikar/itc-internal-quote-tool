"use client";

import { useMemo, useState } from "react";
import SectionCard from "@/components/settings/section-card";
import Field from "@/components/settings/field";
import { SaveFeedback, type SaveState } from "@/components/settings/save-feedback";
import {
  computePriceSheet,
  pricingConfigSchema,
  PricingError,
  type PriceSheet,
  type PricingConfig,
  type PriorityKey,
  type QuoteInputs,
  type SkillType,
  type Tier,
} from "@/lib/pricing";

interface PricingRulesSectionProps {
  initial: PricingConfig;
  currency: string;
  onSaved: (pricing: PricingConfig) => void;
}

const TIER_LABEL: Record<Tier, string> = {
  good: "Good",
  better: "Better",
  best: "Best",
};

const PRIORITY_OPTIONS: { value: PriorityKey; label: string }[] = [
  { value: "p1", label: "P1 — Strategic" },
  { value: "p2", label: "P2 — Preferred" },
  { value: "p3", label: "P3 — Standard" },
];

let bandKeySeed = 0;
function nextBandKey(): string {
  bandKeySeed += 1;
  return `band-${bandKeySeed}`;
}

interface BandRow {
  key: string;
  minYears: string;
  adjPct: string;
}

function toBandRows(bands: PricingConfig["experienceBands"]): BandRow[] {
  return bands.map((b) => ({
    key: nextBandKey(),
    minYears: String(b.minYears),
    adjPct: String(b.adjPct),
  }));
}

async function putPricing(pricing: PricingConfig): Promise<PricingConfig> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pricing }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    pricing?: PricingConfig;
    error?: string;
    issues?: { message: string }[];
  };
  if (!res.ok) {
    const firstIssue = data.issues?.[0]?.message;
    throw new Error(firstIssue ?? data.error ?? "Failed to save pricing rules.");
  }
  if (!data.pricing) {
    throw new Error("Server did not return pricing settings.");
  }
  return data.pricing;
}

export default function PricingRulesSection({
  initial,
  currency,
  onSaved,
}: PricingRulesSectionProps) {
  const [tierGood, setTierGood] = useState(String(initial.tierMultipliers.good));
  const [tierBetter, setTierBetter] = useState(String(initial.tierMultipliers.better));
  const [tierBest, setTierBest] = useState(String(initial.tierMultipliers.best));

  const [bands, setBands] = useState<BandRow[]>(() => toBandRows(initial.experienceBands));

  const [certificationAdjPct, setCertificationAdjPct] = useState(
    String(initial.certificationAdjPct)
  );
  const [nicheSkillAdjPct, setNicheSkillAdjPct] = useState(String(initial.nicheSkillAdjPct));

  const [p1, setP1] = useState(String(initial.priorityDiscounts.p1));
  const [p2, setP2] = useState(String(initial.priorityDiscounts.p2));
  const [p3, setP3] = useState(String(initial.priorityDiscounts.p3));

  const [minMarginMultiplier, setMinMarginMultiplier] = useState(
    String(initial.minMarginMultiplier)
  );
  const [sliderMaxFactor, setSliderMaxFactor] = useState(String(initial.sliderMaxFactor));
  const [roundTo, setRoundTo] = useState(String(initial.roundTo));

  const [state, setState] = useState<SaveState>({ status: "idle" });

  // ---------------------------------------------------------------------
  // Live preview inputs (independent of saved state — reflects current form)
  // ---------------------------------------------------------------------
  const [previewMonthlyCost, setPreviewMonthlyCost] = useState("200000");
  const [previewYearsExperience, setPreviewYearsExperience] = useState("7");
  const [previewSkillType, setPreviewSkillType] = useState<SkillType>("Regular");
  const [previewCertRequired, setPreviewCertRequired] = useState(false);
  const [previewCertHeld, setPreviewCertHeld] = useState(false);
  const [previewPriority, setPreviewPriority] = useState<PriorityKey>("p2");
  const [previewDurationMonths, setPreviewDurationMonths] = useState("6");
  const [previewBudgetPerMonth, setPreviewBudgetPerMonth] = useState("350000");

  function numberOr(value: string, fallback: number): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  const draftConfigResult = useMemo(() => {
    const candidate = {
      tierMultipliers: {
        good: numberOr(tierGood, NaN),
        better: numberOr(tierBetter, NaN),
        best: numberOr(tierBest, NaN),
      },
      experienceBands: bands.map((b) => ({
        minYears: numberOr(b.minYears, NaN),
        adjPct: numberOr(b.adjPct, NaN),
      })),
      certificationAdjPct: numberOr(certificationAdjPct, NaN),
      nicheSkillAdjPct: numberOr(nicheSkillAdjPct, NaN),
      priorityDiscounts: {
        p1: numberOr(p1, NaN),
        p2: numberOr(p2, NaN),
        p3: numberOr(p3, NaN),
      },
      minMarginMultiplier: numberOr(minMarginMultiplier, NaN),
      sliderMaxFactor: numberOr(sliderMaxFactor, NaN),
      roundTo: numberOr(roundTo, NaN),
    };
    return pricingConfigSchema.safeParse(candidate);
  }, [
    tierGood,
    tierBetter,
    tierBest,
    bands,
    certificationAdjPct,
    nicheSkillAdjPct,
    p1,
    p2,
    p3,
    minMarginMultiplier,
    sliderMaxFactor,
    roundTo,
  ]);

  const previewResult = useMemo((): { sheet: PriceSheet } | { error: string } => {
    if (!draftConfigResult.success) {
      return { error: "Fix the pricing rule errors above to see a live preview." };
    }
    const monthlyCost = Number(previewMonthlyCost);
    const yearsExperience = Number(previewYearsExperience);
    const durationMonths = Number(previewDurationMonths);
    const budgetTrimmed = previewBudgetPerMonth.trim();
    const budgetPerMonth =
      budgetTrimmed === "" ? null : Number.isFinite(Number(budgetTrimmed)) ? Number(budgetTrimmed) : null;

    if (!Number.isFinite(monthlyCost)) return { error: "Enter a valid monthly cost." };
    if (!Number.isFinite(yearsExperience)) return { error: "Enter valid years of experience." };
    if (!Number.isFinite(durationMonths)) return { error: "Enter a valid duration." };

    const inputs: QuoteInputs = {
      monthlyCost,
      yearsExperience,
      certificationRequired: previewCertRequired,
      certificationHeld: previewCertHeld,
      skillType: previewSkillType,
      priority: previewPriority,
      durationMonths,
      budgetPerMonth,
    };

    try {
      const sheet = computePriceSheet(inputs, draftConfigResult.data);
      return { sheet };
    } catch (err) {
      if (err instanceof PricingError) return { error: err.message };
      return { error: "Could not compute a preview with these values." };
    }
  }, [
    draftConfigResult,
    previewMonthlyCost,
    previewYearsExperience,
    previewSkillType,
    previewCertRequired,
    previewCertHeld,
    previewPriority,
    previewDurationMonths,
    previewBudgetPerMonth,
  ]);

  const currencyFormatter = useMemo(() => {
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency || "INR",
        maximumFractionDigits: 0,
      });
    } catch {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      });
    }
  }, [currency]);

  function addBandRow() {
    setBands((rows) => [...rows, { key: nextBandKey(), minYears: "0", adjPct: "0" }]);
  }

  function removeBandRow(key: string) {
    setBands((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  }

  function updateBand(key: string, field: "minYears" | "adjPct", value: string) {
    setBands((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = draftConfigResult;
    if (!parsed.success) {
      setState({
        status: "error",
        message: parsed.error.issues[0]?.message ?? "Invalid pricing rules.",
      });
      return;
    }
    setState({ status: "saving" });
    try {
      const updated = await putPricing(parsed.data);
      onSaved(updated);
      // Re-sync local band rows in case the server normalized (sorted) them.
      setBands(toBandRows(updated.experienceBands));
      setState({ status: "saved" });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save.",
      });
    }
  }

  return (
    <SectionCard
      title="Pricing Rules"
      description="Every number here feeds the quote calculator. Changes apply to new quotes only."
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-7">
          <fieldset className="flex flex-col gap-4">
            <legend className="text-sm font-semibold text-ink">Tier multipliers</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                id="pricing-tier-good"
                label="Good"
                type="number"
                step={0.05}
                inputMode="decimal"
                className="tnum"
                value={tierGood}
                onChange={(e) => setTierGood(e.target.value)}
              />
              <Field
                id="pricing-tier-better"
                label="Better"
                type="number"
                step={0.05}
                inputMode="decimal"
                className="tnum"
                value={tierBetter}
                onChange={(e) => setTierBetter(e.target.value)}
              />
              <Field
                id="pricing-tier-best"
                label="Best"
                type="number"
                step={0.05}
                inputMode="decimal"
                className="tnum"
                value={tierBest}
                onChange={(e) => setTierBest(e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold text-ink">Experience bands</legend>
            <p className="text-xs text-muted">
              Adjustment applies for candidates at or above the given years of experience.
            </p>
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium uppercase tracking-wide text-muted">
                <span>From years</span>
                <span>Adjustment %</span>
                <span aria-hidden="true" />
              </div>
              {bands.map((band) => (
                <div key={band.key} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                  <input
                    aria-label="Minimum years"
                    type="number"
                    step={1}
                    inputMode="numeric"
                    value={band.minYears}
                    onChange={(e) => updateBand(band.key, "minYears", e.target.value)}
                    className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
                  />
                  <input
                    aria-label="Adjustment percent"
                    type="number"
                    step={1}
                    inputMode="decimal"
                    value={band.adjPct}
                    onChange={(e) => updateBand(band.key, "adjPct", e.target.value)}
                    className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
                  />
                  <button
                    type="button"
                    onClick={() => removeBandRow(band.key)}
                    disabled={bands.length <= 1}
                    aria-label="Remove band"
                    className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-sm border border-border text-muted transition hover:border-warning hover:text-warning disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <div>
              <button
                type="button"
                onClick={addBandRow}
                className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-ink transition hover:border-accent hover:text-accent"
              >
                + Add band
              </button>
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="text-sm font-semibold text-ink">Premiums</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                id="pricing-certification-pct"
                label="Certification %"
                type="number"
                step={1}
                min={0}
                max={100}
                inputMode="decimal"
                className="tnum"
                value={certificationAdjPct}
                onChange={(e) => setCertificationAdjPct(e.target.value)}
                helperText="Applied when a required certification is held."
              />
              <Field
                id="pricing-niche-skill-pct"
                label="Niche skill %"
                type="number"
                step={1}
                min={0}
                max={100}
                inputMode="decimal"
                className="tnum"
                value={nicheSkillAdjPct}
                onChange={(e) => setNicheSkillAdjPct(e.target.value)}
                helperText="Applied when the required skill is Niche."
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="text-sm font-semibold text-ink">Priority discounts</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                id="pricing-p1-discount"
                label="P1 - Strategic %"
                type="number"
                step={1}
                min={0}
                max={90}
                inputMode="decimal"
                className="tnum"
                value={p1}
                onChange={(e) => setP1(e.target.value)}
              />
              <Field
                id="pricing-p2-discount"
                label="P2 - Preferred %"
                type="number"
                step={1}
                min={0}
                max={90}
                inputMode="decimal"
                className="tnum"
                value={p2}
                onChange={(e) => setP2(e.target.value)}
              />
              <Field
                id="pricing-p3-discount"
                label="P3 - Standard %"
                type="number"
                step={1}
                min={0}
                max={90}
                inputMode="decimal"
                className="tnum"
                value={p3}
                onChange={(e) => setP3(e.target.value)}
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="text-sm font-semibold text-ink">Guardrails</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field
                id="pricing-min-margin"
                label="Min margin multiplier"
                type="number"
                step={0.01}
                min={1}
                max={5}
                inputMode="decimal"
                className="tnum"
                value={minMarginMultiplier}
                onChange={(e) => setMinMarginMultiplier(e.target.value)}
                helperText="Floor = adjusted cost × this value."
              />
              <Field
                id="pricing-slider-max-factor"
                label="Slider max factor"
                type="number"
                step={0.05}
                min={1}
                max={3}
                inputMode="decimal"
                className="tnum"
                value={sliderMaxFactor}
                onChange={(e) => setSliderMaxFactor(e.target.value)}
                helperText="Upper slider bound = Best price × this value."
              />
              <Field
                id="pricing-round-to"
                label="Round to"
                type="number"
                step={1}
                min={1}
                inputMode="numeric"
                className="tnum"
                value={roundTo}
                onChange={(e) => setRoundTo(e.target.value)}
                helperText="Quoted amounts round to the nearest multiple."
              />
            </div>
          </fieldset>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={state.status === "saving"}
              className="inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state.status === "saving" ? "Saving…" : "Save pricing rules"}
            </button>
            <SaveFeedback state={state} />
          </div>
        </form>

        <div className="flex w-full flex-col gap-4 rounded-sm border border-border bg-paper p-5 lg:w-[22rem] lg:flex-none">
          <div>
            <h3 className="text-sm font-semibold text-ink">Try it — example quote</h3>
            <p className="mt-1 text-xs text-muted">
              Recomputed live from the values above, before you save.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Monthly cost
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={previewMonthlyCost}
                onChange={(e) => setPreviewMonthlyCost(e.target.value)}
                className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Years experience
              </span>
              <input
                type="number"
                inputMode="decimal"
                value={previewYearsExperience}
                onChange={(e) => setPreviewYearsExperience(e.target.value)}
                className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Skill type
              </span>
              <select
                value={previewSkillType}
                onChange={(e) => setPreviewSkillType(e.target.value as SkillType)}
                className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
              >
                <option value="Regular">Regular</option>
                <option value="Niche">Niche</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Priority
              </span>
              <select
                value={previewPriority}
                onChange={(e) => setPreviewPriority(e.target.value as PriorityKey)}
                className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Duration (months)
              </span>
              <input
                type="number"
                inputMode="numeric"
                value={previewDurationMonths}
                onChange={(e) => setPreviewDurationMonths(e.target.value)}
                className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Budget / month
              </span>
              <input
                type="number"
                inputMode="decimal"
                placeholder="No budget"
                value={previewBudgetPerMonth}
                onChange={(e) => setPreviewBudgetPerMonth(e.target.value)}
                className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
              />
            </label>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={previewCertRequired}
                onChange={(e) => setPreviewCertRequired(e.target.checked)}
                className="h-4 w-4 rounded-sm border-border text-accent focus:ring-accent-light"
              />
              Certification required
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={previewCertHeld}
                onChange={(e) => setPreviewCertHeld(e.target.checked)}
                className="h-4 w-4 rounded-sm border-border text-accent focus:ring-accent-light"
              />
              Certification held
            </label>
          </div>

          <div className="border-t border-border pt-4">
            {"error" in previewResult ? (
              <p className="text-sm italic text-muted">{previewResult.error}</p>
            ) : (
              <PreviewTiers sheet={previewResult.sheet} formatter={currencyFormatter} />
            )}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function PreviewTiers({
  sheet,
  formatter,
}: {
  sheet: PriceSheet;
  formatter: Intl.NumberFormat;
}) {
  return (
    <div className="flex flex-col gap-3">
      {(["good", "better", "best"] as const).map((tier) => {
        const t = sheet.tiers[tier];
        return (
          <div key={tier} className="flex flex-col gap-1 rounded-sm border border-border bg-surface px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-medium text-ink">{TIER_LABEL[tier]}</span>
              <span className="tnum text-sm font-semibold text-ink">
                {formatter.format(t.monthly)}
                <span className="ml-1 text-xs font-normal text-muted">/mo</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="tnum text-xs text-muted">{t.marginPct.toFixed(1)}% margin</span>
              <BudgetChip fit={t.budgetFit} />
              {t.clampedByFloor && (
                <span className="rounded-full bg-amber-light px-2 py-0.5 text-[11px] font-medium text-amber">
                  floor
                </span>
              )}
            </div>
          </div>
        );
      })}
      <p className="tnum text-xs text-muted">Minimum bill: {formatter.format(sheet.minBill)}/mo</p>
    </div>
  );
}

function BudgetChip({ fit }: { fit: PriceSheet["tiers"]["good"]["budgetFit"] }) {
  if (fit.kind === "no-budget") {
    return (
      <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-medium text-muted">
        no budget
      </span>
    );
  }
  if (fit.kind === "fits") {
    return (
      <span className="tnum rounded-full bg-accent-light px-2 py-0.5 text-[11px] font-medium text-accent">
        fits, {fit.headroomPct.toFixed(1)}% headroom
      </span>
    );
  }
  return (
    <span className="tnum rounded-full bg-warning-light px-2 py-0.5 text-[11px] font-medium text-warning">
      over by {fit.overPct.toFixed(1)}%
    </span>
  );
}
