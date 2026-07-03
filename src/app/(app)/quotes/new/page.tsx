"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ResumeDraftBar from "@/components/wizard/resume-draft-bar";
import Stepper from "@/components/wizard/stepper";
import Step1ClientRequirement from "@/components/wizard/step1-client-requirement";
import Step2Resource from "@/components/wizard/step2-resource";
import Step3Pricing from "@/components/wizard/step3-pricing";
import Step4Review from "@/components/wizard/step4-review";
import type { Tier } from "@/lib/pricing";
import {
  EMPTY_DRAFT,
  isStepValid,
  WIZARD_STORAGE_KEY,
  type WizardCustomer,
  type WizardDraft,
  type WizardRequirement,
  type WizardResource,
  type WizardSelection,
} from "@/components/wizard/types";

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "error"; message: string };

interface SourceQuoteRecord {
  id: string;
  draft: {
    customer: { id: string; name: string; priorityRaw: string; priorityKey: "p1" | "p2" | "p3" };
    requirement: {
      yearsExperience: number;
      certificationRequired: boolean;
      certificationHeld: boolean;
      skillType: "Niche" | "Regular";
      durationMonths: number;
      budgetPerMonth: number | null;
    };
    resource: {
      type: "Internal" | "External";
      refId: string | null;
      name: string;
      monthlyCost: number;
      manualCost: boolean;
    };
    selection: { tier: Tier | "custom"; finalMonthlyRate: number };
    preparedBy: string;
    notes: string;
  };
}

function draftFromSource(source: SourceQuoteRecord): WizardDraft {
  const d = source.draft;
  const prefix = `Revision of ${source.id}.`;
  const notes = d.notes ? `${prefix} ${d.notes}` : prefix;
  return {
    customer: { ...d.customer },
    requirement: { ...d.requirement },
    resource: { ...d.resource },
    selection: { ...d.selection },
    preparedBy: d.preparedBy,
    notes,
  };
}

function readRawDraft(): string | null {
  try {
    return window.localStorage.getItem(WIZARD_STORAGE_KEY);
  } catch {
    // Corrupt/blocked storage — ignore, wizard starts fresh.
    return null;
  }
}

function subscribeNoop(): () => void {
  // localStorage isn't reactively observed (no cross-tab sync needed here);
  // this store only needs to be read once, safely, after hydration.
  return () => {};
}

/**
 * Reads the saved draft from localStorage via useSyncExternalStore so the
 * value is null during SSR and the first client render (matching hydration),
 * then resolves to the real value on the client — without ever calling
 * setState in an effect. Note: the SSR/hydration snapshot is always null,
 * so callers must not treat "null on first render" as "no draft exists" —
 * only the post-hydration client value is meaningful.
 */
function useSavedDraftRaw(): string | null {
  return useSyncExternalStore(
    subscribeNoop,
    readRawDraft,
    () => null // server snapshot
  );
}

export default function NewQuotePage() {
  return (
    <Suspense fallback={null}>
      <NewQuotePageInner />
    </Suspense>
  );
}

function NewQuotePageInner() {
  useEffect(() => {
    document.title = "New Quote — ITC Quote Tool";
  }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const fromId = searchParams.get("from");
  const [draft, setDraft] = useState<WizardDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  // A saved draft is only ever applied if the user explicitly clicks
  // "Resume draft" — this just detects whether one exists. Read via
  // useSyncExternalStore (not useState+useEffect) so there is no
  // hydration mismatch and no setState-in-effect.
  const savedDraftRaw = useSavedDraftRaw();
  const savedDraft: WizardDraft | null = (() => {
    if (!savedDraftRaw) return null;
    try {
      return JSON.parse(savedDraftRaw) as WizardDraft;
    } catch {
      return null;
    }
  })();
  // Prefill (revision) overrides any localStorage draft — the resume bar is
  // skipped whenever ?from is present, whether or not prefill has finished
  // loading yet.
  const [draftDismissed, setDraftDismissed] = useState(fromId !== null);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [prefillState, setPrefillState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "loaded"; sourceId: string }
    | { status: "error"; message: string }
  >(fromId ? { status: "loading" } : { status: "idle" });

  useEffect(() => {
    if (!fromId) return;
    let cancelled = false;
    (async () => {
      setPrefillState({ status: "loading" });
      try {
        const res = await fetch(`/api/quotes/${encodeURIComponent(fromId)}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as
          | (SourceQuoteRecord & { error?: string })
          | null;
        if (!res.ok || !data) {
          throw new Error(
            res.status === 404 ? `Quote ${fromId} not found.` : data?.error ?? "Failed to load quote."
          );
        }
        if (cancelled) return;
        setDraft(draftFromSource(data));
        setStep(0);
        setPrefillState({ status: "loaded", sourceId: data.id });
      } catch (err) {
        if (!cancelled) {
          setPrefillState({
            status: "error",
            message: err instanceof Error ? err.message : "Failed to load quote.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromId]);

  // Autosave on every change — but never before the user has resolved an
  // existing saved draft (resume or discard), and never while revising via
  // ?from (prefill takes precedence over any localStorage draft). `savedDraftRaw`
  // is null both "before hydration" and "no draft exists"; we can't tell those
  // apart from render alone, so the effect re-checks localStorage directly at
  // the moment it's about to write, and refuses to clobber a draft it didn't
  // itself create.
  useEffect(() => {
    if (fromId) return;
    if (!draftDismissed && readRawDraft() !== null) return;
    try {
      window.localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Storage full/blocked — silently skip autosave.
    }
  }, [draft, draftDismissed, fromId]);

  const resumeDraft = useCallback(() => {
    if (savedDraft) setDraft(savedDraft);
    setDraftDismissed(true);
  }, [savedDraft]);

  const discardDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(WIZARD_STORAGE_KEY);
    } catch {
      // ignore
    }
    setDraftDismissed(true);
  }, []);

  function clearDraftStorage() {
    try {
      window.localStorage.removeItem(WIZARD_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // Furthest step whose prerequisites are all valid (for stepper click-back).
  let furthestValidStep = 0;
  for (let i = 0; i < 4; i++) {
    if (isStepValid(i, draft)) furthestValidStep = Math.min(i + 1, 3);
    else break;
  }
  // Allow navigating back to any step already passed, regardless of forward validity.
  furthestValidStep = Math.max(furthestValidStep, step);

  const currentStepValid = isStepValid(step, draft);

  function patchRequirement(patch: Partial<WizardRequirement>) {
    setDraft((d) => ({ ...d, requirement: { ...d.requirement, ...patch } }));
  }
  function setCustomer(customer: WizardCustomer) {
    setDraft((d) => ({ ...d, customer }));
  }
  function patchResource(patch: Partial<WizardResource>) {
    setDraft((d) => ({ ...d, resource: { ...d.resource, ...patch } }));
  }
  function setCertificationHeld(held: boolean) {
    setDraft((d) => ({ ...d, requirement: { ...d.requirement, certificationHeld: held } }));
  }
  function patchSelection(patch: Partial<WizardSelection>) {
    setDraft((d) => ({ ...d, selection: { ...d.selection, ...patch } }));
  }
  function setPreparedBy(v: string) {
    setDraft((d) => ({ ...d, preparedBy: v }));
  }
  function setNotes(v: string) {
    setDraft((d) => ({ ...d, notes: v }));
  }

  function goNext() {
    if (!currentStepValid) return;
    setStep((s) => Math.min(s + 1, 3));
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0));
  }
  function jumpTo(target: number) {
    if (target <= furthestValidStep) setStep(target);
  }

  async function handleSubmit() {
    if (!draft.customer || draft.selection.finalMonthlyRate === null) return;

    // Step 3 already surfaces the prominent "below minimum bill" callout
    // (E2) whenever budget < sheet.minBill. As a final safety net before
    // POSTing, reconfirm with the user whenever the client's stated budget
    // is less than the rate actually being quoted — this covers both the
    // floor-clamp case and any custom slider value below budget.
    if (
      draft.requirement.budgetPerMonth !== null &&
      draft.requirement.budgetPerMonth < draft.selection.finalMonthlyRate
    ) {
      const confirmed = window.confirm(
        `Client budget (${draft.requirement.budgetPerMonth}) is below the quoted monthly rate (${draft.selection.finalMonthlyRate}). Continue saving this quote anyway?`
      );
      if (!confirmed) return;
    }

    setSubmitState({ status: "submitting" });
    try {
      const body = {
        customer: draft.customer,
        requirement: {
          yearsExperience: draft.requirement.yearsExperience,
          certificationRequired: draft.requirement.certificationRequired,
          certificationHeld: draft.requirement.certificationHeld,
          skillType: draft.requirement.skillType,
          durationMonths: draft.requirement.durationMonths,
          budgetPerMonth: draft.requirement.budgetPerMonth,
        },
        resource: {
          type: draft.resource.type,
          refId: draft.resource.refId,
          name: draft.resource.name,
          monthlyCost: draft.resource.monthlyCost,
          manualCost: draft.resource.manualCost,
        },
        selection: {
          tier: draft.selection.tier,
          finalMonthlyRate: draft.selection.finalMonthlyRate,
        },
        preparedBy: draft.preparedBy,
        notes: draft.notes || undefined,
      };
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        throw new Error(data.error ?? "Failed to save quote.");
      }
      clearDraftStorage();
      router.push(`/quotes/${data.id}`);
    } catch (err) {
      setSubmitState({
        status: "error",
        message: err instanceof Error ? err.message : "Failed to save quote.",
      });
    }
  }

  const showResumeBar = savedDraft !== null && !draftDismissed;

  if (fromId && prefillState.status === "error") {
    return (
      <div className="flex flex-col gap-6">
        <header>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">New</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">
            Create a Quote
          </h1>
        </header>
        <p role="alert" className="rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
          {prefillState.message}{" "}
          <Link href="/quotes" className="font-medium underline underline-offset-2">
            Back to quotes
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">New</p>
        <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">
          Create a Quote
        </h1>
      </header>

      {fromId && prefillState.status === "loading" && (
        <p className="rounded-sm bg-amber-light px-4 py-2.5 text-xs text-amber">
          Loading quote {fromId} to revise…
        </p>
      )}

      {prefillState.status === "loaded" && (
        <div className="ledger-card ledger-card--accent-left rounded-sm px-5 py-3.5 text-sm text-ink">
          Revising {prefillState.sourceId} — a new quote number will be issued.
        </div>
      )}

      {showResumeBar && <ResumeDraftBar onResume={resumeDraft} onDiscard={discardDraft} />}

      <Stepper current={step} furthestValidStep={furthestValidStep} onJump={jumpTo} />

      <div className="ledger-card animate-rise rounded-sm p-6 sm:p-8">
        {step === 0 && (
          <Step1ClientRequirement
            draft={draft}
            onCustomerChange={setCustomer}
            onRequirementChange={patchRequirement}
          />
        )}
        {step === 1 && (
          <Step2Resource
            draft={draft}
            onResourceChange={patchResource}
            onCertificationHeldChange={setCertificationHeld}
          />
        )}
        {step === 2 && <Step3Pricing draft={draft} onSelectionChange={patchSelection} />}
        {step === 3 && (
          <Step4Review
            draft={draft}
            onJumpToStep={jumpTo}
            onPreparedByChange={setPreparedBy}
            onNotesChange={setNotes}
          />
        )}
      </div>

      {submitState.status === "error" && (
        <p role="alert" className="rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
          {submitState.message}
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0}
          className="inline-flex items-center justify-center rounded-sm border border-border px-4 py-2.5 text-sm font-medium text-ink transition duration-150 hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Back
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!currentStepValid}
            className="inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!currentStepValid || submitState.status === "submitting"}
            className="inline-flex items-center justify-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitState.status === "submitting" ? "Saving…" : "Save quote"}
          </button>
        )}
      </div>
    </div>
  );
}
