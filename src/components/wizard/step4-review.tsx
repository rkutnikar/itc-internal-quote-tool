"use client";

import { useEffect, useMemo, useState } from "react";
import type { PricingConfig } from "@/lib/pricing";
import PriorityChip from "@/components/wizard/priority-chip";
import { makeCurrencyFormatter } from "@/components/wizard/format";
import type { WizardDraft } from "@/components/wizard/types";

interface SettingsResponse {
  pricing: PricingConfig;
  general: { currency: string; quoteValidityDays: number };
}

interface Step4Props {
  draft: WizardDraft;
  onJumpToStep: (step: number) => void;
  onPreparedByChange: (v: string) => void;
  onNotesChange: (v: string) => void;
}

export default function Step4Review({
  draft,
  onJumpToStep,
  onPreparedByChange,
  onNotesChange,
}: Step4Props) {
  const [settings, setSettings] = useState<SettingsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as
          | (SettingsResponse & { error?: string })
          | null;
        if (res.ok && data && !cancelled) {
          setSettings({ pricing: data.pricing, general: data.general });
        }
      } catch {
        // Silent — the review page can still render without live settings;
        // validity note falls back to a generic message.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatter = useMemo(
    () => makeCurrencyFormatter(settings?.general.currency ?? "INR"),
    [settings]
  );

  const validUntil = computeValidUntil(settings);

  const rate = draft.selection.finalMonthlyRate ?? 0;
  const duration = draft.requirement.durationMonths ?? 0;
  const total = rate * duration;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-display text-xl font-semibold text-ink">Review & generate</h2>
        <p className="mt-1 text-sm text-muted">Confirm the details before saving the quote.</p>
      </div>

      <ReviewGroup title="Customer" onEdit={() => onJumpToStep(0)}>
        {draft.customer ? (
          <div className="flex items-center gap-2">
            <PriorityChip priorityKey={draft.customer.priorityKey} />
            <span className="text-sm font-medium text-ink">{draft.customer.name}</span>
          </div>
        ) : (
          <p className="text-sm text-muted">Not selected.</p>
        )}
      </ReviewGroup>

      <ReviewGroup title="Requirement" onEdit={() => onJumpToStep(0)}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <ReviewField label="Experience" value={`${draft.requirement.yearsExperience ?? "—"} yrs`} />
          <ReviewField label="Skill type" value={draft.requirement.skillType} />
          <ReviewField label="Duration" value={`${draft.requirement.durationMonths ?? "—"} mo`} />
          <ReviewField
            label="Budget/mo"
            value={
              draft.requirement.budgetPerMonth !== null
                ? formatter.format(draft.requirement.budgetPerMonth)
                : "Not set"
            }
          />
          <ReviewField
            label="Certification required"
            value={draft.requirement.certificationRequired ? "Yes" : "No"}
          />
          {draft.requirement.certificationRequired && (
            <ReviewField
              label="Certification held"
              value={draft.requirement.certificationHeld ? "Yes" : "No"}
            />
          )}
        </dl>
      </ReviewGroup>

      <ReviewGroup title="Resource" onEdit={() => onJumpToStep(1)}>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <ReviewField label="Type" value={draft.resource.type} />
          <ReviewField label="Name" value={draft.resource.name || "—"} />
          <ReviewField
            label="Monthly cost"
            value={
              draft.resource.monthlyCost !== null ? formatter.format(draft.resource.monthlyCost) : "—"
            }
          />
          <ReviewField label="Cost source" value={draft.resource.manualCost ? "Manual entry" : "Directory"} />
        </dl>
      </ReviewGroup>

      <ReviewGroup title="Pricing" onEdit={() => onJumpToStep(2)}>
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Tier {draft.selection.tier !== "custom" ? `(${draft.selection.tier})` : "(custom)"}
            </p>
            <p className="tnum mt-0.5 font-display text-2xl font-semibold text-ink">
              {formatter.format(rate)}
              <span className="ml-1 text-sm font-normal text-muted">/mo</span>
            </p>
          </div>
          <ReviewField label="Total contract value" value={formatter.format(total)} />
        </div>
      </ReviewGroup>

      <section className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Prepared by
            </span>
            <input
              type="text"
              required
              value={draft.preparedBy}
              onChange={(e) => onPreparedByChange(e.target.value)}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            Notes (optional)
          </span>
          <textarea
            rows={4}
            maxLength={2000}
            value={draft.notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
          />
        </label>

        <p className="text-xs text-muted">
          {validUntil
            ? `Valid until ${validUntil.date} — ${validUntil.days} days`
            : "Validity period will be computed on save."}
        </p>
      </section>
    </div>
  );
}

function ReviewGroup({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-b border-border pb-6 last:border-b-0 last:pb-0">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="text-xs font-medium text-accent underline underline-offset-2 hover:no-underline"
        >
          Edit
        </button>
      </div>
      {children}
    </section>
  );
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="tnum text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function computeValidUntil(settings: SettingsResponse | null): { date: string; days: number } | null {
  if (!settings) return null;
  const days = settings.general.quoteValidityDays;
  const d = new Date(Date.now() + days * 86_400_000);
  return {
    date: d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }),
    days,
  };
}
