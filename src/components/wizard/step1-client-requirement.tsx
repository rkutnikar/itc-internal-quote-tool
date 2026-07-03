"use client";

import { useEffect, useState } from "react";
import type { DirectoryCustomer, DirectoryResult } from "@/lib/directory";
import ComboboxList from "@/components/wizard/combobox-list";
import DirectoryBanner from "@/components/wizard/directory-banner";
import PriorityChip from "@/components/wizard/priority-chip";
import SegmentedControl from "@/components/wizard/segmented-control";
import type { WizardCustomer, WizardDraft, WizardRequirement } from "@/components/wizard/types";
import type { SkillType } from "@/lib/pricing";
import { fetchJson } from "@/components/use-api";

interface Step1Props {
  draft: WizardDraft;
  onCustomerChange: (customer: WizardCustomer) => void;
  onRequirementChange: (patch: Partial<WizardRequirement>) => void;
}

export default function Step1ClientRequirement({
  draft,
  onCustomerChange,
  onRequirementChange,
}: Step1Props) {
  const [result, setResult] = useState<DirectoryResult<DirectoryCustomer> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchJson<DirectoryResult<DirectoryCustomer>>("/api/directory/customers");
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load customers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const r = draft.requirement;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Customer</h2>
          <p className="mt-1 text-sm text-muted">Search and select the client for this quote.</p>
        </div>

        {result && (result.source === "mock" || result.degraded) && (
          <DirectoryBanner source={result.source} degraded={result.degraded} />
        )}

        {error && (
          <p role="alert" className="rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
            {error}
          </p>
        )}

        {loading && !result && <ComboboxSkeleton />}

        {draft.customer && (
          <div className="ledger-card ledger-card--accent-left flex items-center justify-between gap-3 rounded-sm px-4 py-3">
            <div className="flex items-center gap-2">
              <PriorityChip priorityKey={draft.customer.priorityKey} />
              <span className="text-sm font-medium text-ink">{draft.customer.name}</span>
            </div>
            <span className="text-xs text-muted">Selected</span>
          </div>
        )}

        {result && (
          <ComboboxList
            items={result.items}
            getKey={(c) => c.id}
            getLabel={(c) => c.name}
            filterText={(c, q) => c.name.toLowerCase().includes(q)}
            ariaLabel="Search customers"
            placeholder="Search customers by name…"
            emptyText="No customers match your search."
            onSelect={(c) =>
              onCustomerChange({
                id: c.id,
                name: c.name,
                priorityRaw: c.priorityRaw,
                priorityKey: c.priorityKey,
              })
            }
            renderItem={(c) => (
              <span className="flex items-center gap-2">
                <PriorityChip priorityKey={c.priorityKey} />
                <span>{c.name}</span>
              </span>
            )}
          />
        )}
      </section>

      <section className="flex flex-col gap-5">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Requirement</h2>
          <p className="mt-1 text-sm text-muted">Describe the role being staffed.</p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Years of experience required
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={50}
              value={r.yearsExperience ?? ""}
              onChange={(e) =>
                onRequirementChange({
                  yearsExperience: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Duration (months)
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              value={r.durationMonths ?? ""}
              onChange={(e) =>
                onRequirementChange({
                  durationMonths: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Skill type
            </span>
            <SegmentedControl<SkillType>
              ariaLabel="Skill type"
              value={r.skillType}
              onChange={(v) => onRequirementChange({ skillType: v })}
              options={[
                { value: "Regular", label: "Regular" },
                { value: "Niche", label: "Niche" },
              ]}
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Budget per month (optional)
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="No budget set"
                value={r.budgetPerMonth ?? ""}
                onChange={(e) =>
                  onRequirementChange({
                    budgetPerMonth: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
                className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
              />
              {r.budgetPerMonth !== null && (
                <button
                  type="button"
                  onClick={() => onRequirementChange({ budgetPerMonth: null })}
                  aria-label="Clear budget"
                  className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-sm border border-border text-muted transition hover:border-warning hover:text-warning"
                >
                  &times;
                </button>
              )}
            </div>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={r.certificationRequired}
            onChange={(e) =>
              onRequirementChange({
                certificationRequired: e.target.checked,
                certificationHeld: e.target.checked ? r.certificationHeld : false,
              })
            }
            className="h-4 w-4 rounded-sm border-border text-accent focus:ring-accent-light"
          />
          Certification required
        </label>
      </section>
    </div>
  );
}

function ComboboxSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-9 w-full animate-pulse rounded-sm bg-border/40" />
      <div className="flex flex-col gap-1.5 rounded-sm border border-border p-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-full animate-pulse rounded-sm bg-border/30" />
        ))}
      </div>
    </div>
  );
}
