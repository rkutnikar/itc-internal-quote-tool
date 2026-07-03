import { describe, expect, it } from "vitest";
import {
  PricingError,
  clampRate,
  computePriceSheet,
  defaultPricingConfig,
  experienceAdjPct,
  priorityKeyFromValue,
  type QuoteInputs,
} from "./pricing";

const config = defaultPricingConfig();

const baseInputs: QuoteInputs = {
  monthlyCost: 200_000,
  yearsExperience: 0,
  certificationRequired: false,
  certificationHeld: false,
  skillType: "Regular",
  priority: "p3",
  durationMonths: 6,
  budgetPerMonth: null,
};

describe("experienceAdjPct", () => {
  it("applies band boundaries inclusively", () => {
    const bands = config.experienceBands;
    expect(experienceAdjPct(0, bands)).toBe(0);
    expect(experienceAdjPct(2, bands)).toBe(0);
    expect(experienceAdjPct(3, bands)).toBe(5);
    expect(experienceAdjPct(5, bands)).toBe(5);
    expect(experienceAdjPct(6, bands)).toBe(10);
    expect(experienceAdjPct(10, bands)).toBe(15);
    expect(experienceAdjPct(40, bands)).toBe(15);
  });

  it("tolerates unsorted band config", () => {
    const bands = [
      { minYears: 6, adjPct: 10 },
      { minYears: 0, adjPct: 0 },
      { minYears: 3, adjPct: 5 },
    ];
    expect(experienceAdjPct(4, bands)).toBe(5);
  });
});

describe("computePriceSheet — plan §6 worked example", () => {
  // CTC ₹24L → 2,00,000/mo; 7 yrs (+10%), niche (+10%) ⇒ adjusted 2,40,000.
  // P2 (−5%): Good 3,19,200 · Better 3,64,800 · Best 4,21,800 (before rounding)
  const inputs: QuoteInputs = {
    ...baseInputs,
    yearsExperience: 7,
    skillType: "Niche",
    priority: "p2",
    budgetPerMonth: 350_000,
  };

  it("matches the worked example (rounded to ₹100)", () => {
    const sheet = computePriceSheet(inputs, config);
    expect(sheet.adjustedCost).toBe(240_000);
    expect(sheet.adjustments).toEqual({
      experiencePct: 10,
      certificationPct: 0,
      skillPct: 10,
    });
    expect(sheet.discountPct).toBe(5);
    expect(sheet.tiers.good.monthly).toBe(319_200);
    expect(sheet.tiers.better.monthly).toBe(364_800);
    expect(sheet.tiers.best.monthly).toBe(421_800);
    expect(sheet.minBill).toBe(276_000);
  });

  it("computes budget fit per tier", () => {
    const sheet = computePriceSheet(inputs, config);
    expect(sheet.tiers.good.budgetFit.kind).toBe("fits");
    expect(sheet.tiers.better.budgetFit).toEqual({
      kind: "over",
      overPct: 4.23,
    });
    expect(sheet.tiers.best.budgetFit.kind).toBe("over");
  });

  it("computes totals over duration", () => {
    const sheet = computePriceSheet(inputs, config);
    expect(sheet.tiers.good.total).toBe(319_200 * 6);
  });
});

describe("certification premium (E3)", () => {
  it("applies only when required AND held", () => {
    const cases: [boolean, boolean, number][] = [
      [true, true, config.certificationAdjPct],
      [true, false, 0],
      [false, true, 0],
      [false, false, 0],
    ];
    for (const [required, held, expected] of cases) {
      const sheet = computePriceSheet(
        {
          ...baseInputs,
          certificationRequired: required,
          certificationHeld: held,
        },
        config
      );
      expect(sheet.adjustments.certificationPct).toBe(expected);
    }
  });
});

describe("minimum bill floor (E7)", () => {
  it("clamps discounted tiers to the floor", () => {
    // Aggressive discount + low multiplier pushes Good below min margin.
    const aggressive = {
      ...config,
      tierMultipliers: { good: 1.1, better: 1.6, best: 1.85 },
      priorityDiscounts: { p1: 20, p2: 5, p3: 0 },
    };
    const sheet = computePriceSheet(
      { ...baseInputs, priority: "p1" },
      aggressive
    );
    // good: 200000×1.1×0.8 = 176,000 < floor 230,000
    expect(sheet.minBill).toBe(230_000);
    expect(sheet.tiers.good.monthly).toBe(230_000);
    expect(sheet.tiers.good.clampedByFloor).toBe(true);
    expect(sheet.tiers.best.clampedByFloor).toBe(false);
  });

  it("rounds the floor up, never down", () => {
    const sheet = computePriceSheet(
      { ...baseInputs, monthlyCost: 100_001 },
      config
    );
    // 100001 × 1.15 = 115,001.15 → ceil to 115,100
    expect(sheet.minBill).toBe(115_100);
    expect(sheet.minBill).toBeGreaterThanOrEqual(100_001 * 1.15);
  });
});

describe("input validation", () => {
  it("rejects non-positive monthly cost (E1 manual entry guard)", () => {
    expect(() =>
      computePriceSheet({ ...baseInputs, monthlyCost: 0 }, config)
    ).toThrow(PricingError);
    expect(() =>
      computePriceSheet({ ...baseInputs, monthlyCost: -5 }, config)
    ).toThrow(PricingError);
    expect(() =>
      computePriceSheet({ ...baseInputs, monthlyCost: NaN }, config)
    ).toThrow(PricingError);
  });

  it("rejects zero/negative duration (E8)", () => {
    expect(() =>
      computePriceSheet({ ...baseInputs, durationMonths: 0 }, config)
    ).toThrow(PricingError);
  });

  it("rejects negative experience", () => {
    expect(() =>
      computePriceSheet({ ...baseInputs, yearsExperience: -1 }, config)
    ).toThrow(PricingError);
  });
});

describe("slider behaviour", () => {
  it("clamps and snaps rates to the increment", () => {
    const sheet = computePriceSheet(baseInputs, config);
    expect(clampRate(0, sheet, config.roundTo)).toBe(sheet.sliderMin);
    expect(clampRate(10_000_000, sheet, config.roundTo)).toBe(sheet.sliderMax);
    const mid = sheet.sliderMin + 12_345;
    expect(clampRate(mid, sheet, config.roundTo) % config.roundTo).toBe(0);
  });

  it("keeps sliderMax ≥ floor even with extreme discounts", () => {
    const extreme = {
      ...config,
      priorityDiscounts: { p1: 90, p2: 5, p3: 0 },
    };
    const sheet = computePriceSheet({ ...baseInputs, priority: "p1" }, extreme);
    expect(sheet.sliderMax).toBeGreaterThanOrEqual(sheet.sliderMin);
  });
});

describe("priorityKeyFromValue", () => {
  it("maps Frappe select values and defaults to p3", () => {
    expect(priorityKeyFromValue("P1 - Strategic")).toBe("p1");
    expect(priorityKeyFromValue("P2 - Preferred")).toBe("p2");
    expect(priorityKeyFromValue("P3 - Standard")).toBe("p3");
    expect(priorityKeyFromValue("p1 - strategic")).toBe("p1");
    expect(priorityKeyFromValue(null)).toBe("p3");
    expect(priorityKeyFromValue("")).toBe("p3");
    expect(priorityKeyFromValue("Gold")).toBe("p3");
  });
});

describe("no-budget handling (budget optional)", () => {
  it("returns no-budget fit when budget missing or zero", () => {
    const sheet = computePriceSheet(baseInputs, config);
    expect(sheet.tiers.good.budgetFit).toEqual({ kind: "no-budget" });
    const zero = computePriceSheet(
      { ...baseInputs, budgetPerMonth: 0 },
      config
    );
    expect(zero.tiers.good.budgetFit).toEqual({ kind: "no-budget" });
  });
});
