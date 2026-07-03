import type { PriorityKey, SkillType, Tier } from "@/lib/pricing";

/**
 * Shared wizard draft shape. Mirrors the server's quoteDraftSchema closely,
 * but every field is optional/partial while the user is still filling the
 * wizard in — validity per-step is checked separately by isStepValid().
 */

export interface WizardCustomer {
  id: string;
  name: string;
  priorityRaw: string;
  priorityKey: PriorityKey;
}

export interface WizardRequirement {
  yearsExperience: number | null;
  certificationRequired: boolean;
  certificationHeld: boolean;
  skillType: SkillType;
  durationMonths: number | null;
  budgetPerMonth: number | null;
}

export type ResourceType = "Internal" | "External";

export interface WizardResource {
  type: ResourceType;
  refId: string | null;
  name: string;
  monthlyCost: number | null;
  manualCost: boolean;
}

export interface WizardSelection {
  tier: Tier | "custom";
  finalMonthlyRate: number | null;
}

export interface WizardDraft {
  customer: WizardCustomer | null;
  requirement: WizardRequirement;
  resource: WizardResource;
  selection: WizardSelection;
  preparedBy: string;
  notes: string;
}

export const EMPTY_DRAFT: WizardDraft = {
  customer: null,
  requirement: {
    yearsExperience: null,
    certificationRequired: false,
    certificationHeld: false,
    skillType: "Regular",
    durationMonths: null,
    budgetPerMonth: null,
  },
  resource: {
    type: "Internal",
    refId: null,
    name: "",
    monthlyCost: null,
    manualCost: false,
  },
  selection: {
    tier: "good",
    finalMonthlyRate: null,
  },
  preparedBy: "",
  notes: "",
};

export const WIZARD_STORAGE_KEY = "quote-draft-v1";

export const STEP_LABELS = [
  "Client & Requirement",
  "Resource",
  "Pricing",
  "Review",
] as const;

export function isStep1Valid(draft: WizardDraft): boolean {
  const r = draft.requirement;
  return (
    draft.customer !== null &&
    r.yearsExperience !== null &&
    r.yearsExperience >= 0 &&
    r.yearsExperience <= 50 &&
    r.durationMonths !== null &&
    r.durationMonths >= 1 &&
    r.durationMonths <= 60
  );
}

export function isStep2Valid(draft: WizardDraft): boolean {
  const res = draft.resource;
  if (!res.name.trim()) return false;
  if (res.monthlyCost === null || res.monthlyCost <= 0) return false;
  if (draft.requirement.certificationRequired) {
    // certificationHeld is a boolean; no extra validity requirement — either
    // value is acceptable, the checkbox just needs to have been visitable.
  }
  return true;
}

export function isStep3Valid(draft: WizardDraft): boolean {
  return draft.selection.finalMonthlyRate !== null && draft.selection.finalMonthlyRate > 0;
}

export function isStep4Valid(draft: WizardDraft): boolean {
  return draft.preparedBy.trim().length > 0;
}

export function isStepValid(step: number, draft: WizardDraft): boolean {
  switch (step) {
    case 0:
      return isStep1Valid(draft);
    case 1:
      return isStep2Valid(draft);
    case 2:
      return isStep3Valid(draft);
    case 3:
      return isStep4Valid(draft);
    default:
      return false;
  }
}
