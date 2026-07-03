import { z } from "zod";

/**
 * Pricing engine — pure and isomorphic (no fs/env), so the browser can
 * compute live previews with the same code the server quotes with.
 *
 * rate = (monthlyCost × (1 + adjustments)) × tierMultiplier × (1 − discount)
 * floor = adjustedCost × minMarginMultiplier   (discounts never cut below it)
 */

export const pricingConfigSchema = z.object({
  tierMultipliers: z
    .object({
      good: z.number().positive().default(1.4),
      better: z.number().positive().default(1.6),
      best: z.number().positive().default(1.85),
    })
    .prefault({}),
  // Sorted ascending by minYears at parse time; band applies from minYears up.
  experienceBands: z
    .array(
      z.object({
        minYears: z.number().int().min(0),
        adjPct: z.number().min(-50).max(200),
      })
    )
    .min(1)
    .default([
      { minYears: 0, adjPct: 0 },
      { minYears: 3, adjPct: 5 },
      { minYears: 6, adjPct: 10 },
      { minYears: 10, adjPct: 15 },
    ]),
  certificationAdjPct: z.number().min(0).max(100).default(5),
  nicheSkillAdjPct: z.number().min(0).max(100).default(10),
  priorityDiscounts: z
    .object({
      p1: z.number().min(0).max(90).default(10),
      p2: z.number().min(0).max(90).default(5),
      p3: z.number().min(0).max(90).default(0),
    })
    .prefault({}),
  minMarginMultiplier: z.number().min(1).max(5).default(1.15),
  // Slider upper bound = best price × this factor
  sliderMaxFactor: z.number().min(1).max(3).default(1.1),
  // Quoted amounts rounded to this increment (e.g. 100 → nearest ₹100)
  roundTo: z.number().int().min(1).default(100),
});

export type PricingConfig = z.infer<typeof pricingConfigSchema>;

export function defaultPricingConfig(): PricingConfig {
  return pricingConfigSchema.parse({});
}

export type SkillType = "Niche" | "Regular";
export type PriorityKey = "p1" | "p2" | "p3";
export type Tier = "good" | "better" | "best";

export interface QuoteInputs {
  /** CTC/12 for internal, vendor rate for external. Must be > 0. */
  monthlyCost: number;
  yearsExperience: number;
  certificationRequired: boolean;
  certificationHeld: boolean;
  skillType: SkillType;
  priority: PriorityKey;
  durationMonths: number;
  /** Client budget per month; null when not provided. */
  budgetPerMonth: number | null;
}

export type BudgetFit =
  | { kind: "no-budget" }
  | { kind: "fits"; headroomPct: number }
  | { kind: "over"; overPct: number };

export interface TierPrice {
  tier: Tier;
  monthly: number;
  total: number;
  marginPct: number;
  budgetFit: BudgetFit;
  /** True when the discounted price hit the minimum-bill floor (E7). */
  clampedByFloor: boolean;
}

export interface PriceSheet {
  monthlyCost: number;
  adjustedCost: number;
  adjustments: {
    experiencePct: number;
    certificationPct: number;
    skillPct: number;
  };
  discountPct: number;
  minBill: number;
  sliderMin: number;
  sliderMax: number;
  tiers: Record<Tier, TierPrice>;
}

export class PricingError extends Error {}

function roundTo(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function ceilTo(value: number, increment: number): number {
  return Math.ceil(value / increment) * increment;
}

export function experienceAdjPct(
  years: number,
  bands: PricingConfig["experienceBands"]
): number {
  const sorted = [...bands].sort((a, b) => a.minYears - b.minYears);
  let pct = sorted[0].adjPct;
  for (const band of sorted) {
    if (years >= band.minYears) pct = band.adjPct;
  }
  return pct;
}

export function budgetFit(monthly: number, budget: number | null): BudgetFit {
  if (budget === null || budget <= 0) return { kind: "no-budget" };
  if (monthly <= budget) {
    return { kind: "fits", headroomPct: round2(((budget - monthly) / budget) * 100) };
  }
  return { kind: "over", overPct: round2(((monthly - budget) / budget) * 100) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function marginPct(rate: number, adjustedCost: number): number {
  return round2(((rate - adjustedCost) / adjustedCost) * 100);
}

export function computePriceSheet(
  inputs: QuoteInputs,
  config: PricingConfig
): PriceSheet {
  if (!Number.isFinite(inputs.monthlyCost) || inputs.monthlyCost <= 0) {
    throw new PricingError("Monthly cost must be a positive number.");
  }
  if (!Number.isFinite(inputs.durationMonths) || inputs.durationMonths <= 0) {
    throw new PricingError("Duration must be at least 1 month.");
  }
  if (inputs.yearsExperience < 0) {
    throw new PricingError("Years of experience cannot be negative.");
  }

  const experiencePct = experienceAdjPct(
    inputs.yearsExperience,
    config.experienceBands
  );
  // Premium only when the requirement asks for a certification AND the
  // candidate holds it — holding an irrelevant cert earns nothing.
  const certificationPct =
    inputs.certificationRequired && inputs.certificationHeld
      ? config.certificationAdjPct
      : 0;
  const skillPct = inputs.skillType === "Niche" ? config.nicheSkillAdjPct : 0;

  const adjustedCost =
    inputs.monthlyCost * (1 + (experiencePct + certificationPct + skillPct) / 100);

  const discountPct = config.priorityDiscounts[inputs.priority];

  // Floor rounds UP so rounding never drops the rate below minimum margin.
  const minBill = ceilTo(adjustedCost * config.minMarginMultiplier, config.roundTo);

  const tiers = {} as Record<Tier, TierPrice>;
  for (const tier of ["good", "better", "best"] as const) {
    const raw =
      adjustedCost * config.tierMultipliers[tier] * (1 - discountPct / 100);
    const rounded = roundTo(raw, config.roundTo);
    const clampedByFloor = rounded < minBill;
    const monthly = clampedByFloor ? minBill : rounded;
    tiers[tier] = {
      tier,
      monthly,
      total: monthly * inputs.durationMonths,
      marginPct: marginPct(monthly, adjustedCost),
      budgetFit: budgetFit(monthly, inputs.budgetPerMonth),
      clampedByFloor,
    };
  }

  const sliderMax = ceilTo(
    Math.max(tiers.best.monthly * config.sliderMaxFactor, minBill),
    config.roundTo
  );

  return {
    monthlyCost: inputs.monthlyCost,
    adjustedCost: round2(adjustedCost),
    adjustments: { experiencePct, certificationPct, skillPct },
    discountPct,
    minBill,
    sliderMin: minBill,
    sliderMax,
    tiers,
  };
}

/** Clamp an arbitrary slider rate into the valid quoting range. */
export function clampRate(rate: number, sheet: PriceSheet, increment: number): number {
  const snapped = roundTo(rate, increment);
  return Math.min(Math.max(snapped, sheet.sliderMin), sheet.sliderMax);
}

/** Map a Frappe priority value ("P1 - Strategic") to a config key. */
export function priorityKeyFromValue(value: string | null | undefined): PriorityKey {
  const v = (value ?? "").toUpperCase();
  if (v.startsWith("P1")) return "p1";
  if (v.startsWith("P2")) return "p2";
  return "p3";
}
