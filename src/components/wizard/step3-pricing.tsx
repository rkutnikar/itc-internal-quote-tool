"use client";

import { useEffect, useMemo, useState } from "react";
import {
  computePriceSheet,
  PricingError,
  type PriceSheet,
  type PricingConfig,
  type QuoteInputs,
  type Tier,
} from "@/lib/pricing";
import CalculationBreakdown from "@/components/wizard/calculation-breakdown";
import PriceSlider from "@/components/wizard/price-slider";
import TierCard from "@/components/wizard/tier-card";
import { makeCurrencyFormatter } from "@/components/wizard/format";
import type { WizardDraft, WizardSelection } from "@/components/wizard/types";
import { fetchJson } from "@/components/use-api";

interface SettingsResponse {
  pricing: PricingConfig;
  general: { currency: string; quoteValidityDays: number };
}

interface Step3Props {
  draft: WizardDraft;
  onSelectionChange: (patch: Partial<WizardSelection>) => void;
}

const TIERS: Tier[] = ["good", "better", "best"];

export default function Step3Pricing({ draft, onSelectionChange }: Step3Props) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchJson<SettingsResponse>("/api/settings");
        if (!cancelled) setSettings({ pricing: data.pricing, general: data.general });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const inputs: QuoteInputs | null = useMemo(() => {
    if (!draft.customer || draft.resource.monthlyCost === null) return null;
    if (draft.requirement.yearsExperience === null || draft.requirement.durationMonths === null) {
      return null;
    }
    return {
      monthlyCost: draft.resource.monthlyCost,
      yearsExperience: draft.requirement.yearsExperience,
      certificationRequired: draft.requirement.certificationRequired,
      certificationHeld: draft.requirement.certificationHeld,
      skillType: draft.requirement.skillType,
      priority: draft.customer.priorityKey,
      durationMonths: draft.requirement.durationMonths,
      budgetPerMonth: draft.requirement.budgetPerMonth,
    };
  }, [draft]);

  const sheetResult: { sheet: PriceSheet } | { error: string } | null = useMemo(() => {
    if (!settings || !inputs) return null;
    try {
      return { sheet: computePriceSheet(inputs, settings.pricing) };
    } catch (err) {
      if (err instanceof PricingError) return { error: err.message };
      return { error: "Could not compute pricing for this quote." };
    }
  }, [settings, inputs]);

  const formatter = useMemo(
    () => makeCurrencyFormatter(settings?.general.currency ?? "INR"),
    [settings]
  );

  // Initialize / sync selection.finalMonthlyRate once a sheet is available.
  useEffect(() => {
    if (!sheetResult || !("sheet" in sheetResult)) return;
    if (draft.selection.finalMonthlyRate === null) {
      onSelectionChange({
        tier: "good",
        finalMonthlyRate: sheetResult.sheet.tiers.good.monthly,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetResult]);

  if (loading && !settings) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-sm border border-border bg-border/20" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
        {error}
      </p>
    );
  }

  if (!settings) return null;

  if (!inputs) {
    return (
      <p className="rounded-sm bg-paper px-4 py-3 text-sm text-muted">
        Complete the previous steps to see pricing.
      </p>
    );
  }

  if (!sheetResult || "error" in sheetResult) {
    return (
      <p role="alert" className="rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
        {sheetResult?.error ?? "Could not compute pricing for this quote."}
      </p>
    );
  }

  const { sheet } = sheetResult;
  const roundTo = settings.pricing.roundTo;
  const selectedRate = draft.selection.finalMonthlyRate ?? sheet.tiers.good.monthly;
  const budget = draft.requirement.budgetPerMonth;

  function selectTier(tier: Tier) {
    onSelectionChange({ tier, finalMonthlyRate: sheet.tiers[tier].monthly });
  }

  function handleSlider(value: number) {
    const matchedTier = TIERS.find((t) => sheet.tiers[t].monthly === value);
    onSelectionChange({
      tier: matchedTier ?? "custom",
      finalMonthlyRate: value,
    });
  }

  const selectedMargin =
    ((selectedRate - sheet.adjustedCost) / sheet.adjustedCost) * 100;
  const selectedTotal = selectedRate * (draft.requirement.durationMonths ?? 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Pricing</h2>
        <p className="mt-1 text-sm text-muted">
          Pick a tier or fine-tune the rate with the slider below.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {TIERS.map((tier) => (
          <TierCard
            key={tier}
            tier={tier}
            price={sheet.tiers[tier]}
            selected={draft.selection.tier === tier}
            onSelect={() => selectTier(tier)}
            formatter={formatter}
          />
        ))}
      </div>

      {budget !== null && budget < sheet.minBill && (
        <div className="rounded-sm bg-amber-light px-4 py-3.5">
          <p className="text-sm font-medium text-amber">
            Client budget {formatter.format(budget)} is below the minimum bill{" "}
            {formatter.format(sheet.minBill)}.
          </p>
          <p className="mt-1 text-xs text-amber">
            You can still continue — just flag this with the client before sending.
          </p>
        </div>
      )}

      <div className="ledger-card flex flex-col gap-5 rounded-sm p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Selected monthly rate {draft.selection.tier === "custom" && "(custom)"}
            </p>
            <p className="tnum mt-1 font-display text-4xl font-semibold text-ink">
              {formatter.format(selectedRate)}
            </p>
          </div>
          <div className="flex gap-6 text-right">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Margin</p>
              <p className="tnum mt-1 text-lg font-semibold text-ink">
                {selectedMargin.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Total ({draft.requirement.durationMonths} mo)
              </p>
              <p className="tnum mt-1 text-lg font-semibold text-ink">
                {formatter.format(selectedTotal)}
              </p>
            </div>
          </div>
        </div>

        <PriceSlider
          sheet={sheet}
          roundTo={roundTo}
          value={selectedRate}
          onChange={handleSlider}
          budgetPerMonth={budget}
          formatter={formatter}
        />
      </div>

      <CalculationBreakdown
        sheet={sheet}
        tierMultipliers={settings.pricing.tierMultipliers}
        roundTo={roundTo}
        formatter={formatter}
        selectedTier={draft.selection.tier}
      />
    </div>
  );
}
