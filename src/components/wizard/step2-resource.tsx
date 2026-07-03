"use client";

import { useEffect, useState } from "react";
import type {
  DirectoryEmployee,
  DirectoryResult,
  DirectorySupplier,
} from "@/lib/directory";
import ComboboxList from "@/components/wizard/combobox-list";
import DirectoryBanner from "@/components/wizard/directory-banner";
import SegmentedControl from "@/components/wizard/segmented-control";
import type { ResourceType, WizardDraft, WizardResource } from "@/components/wizard/types";
import { fetchJson } from "@/components/use-api";

interface Step2Props {
  draft: WizardDraft;
  onResourceChange: (patch: Partial<WizardResource>) => void;
  onCertificationHeldChange: (held: boolean) => void;
}

const NEW_VENDOR_KEY = "__new_vendor__";

export default function Step2Resource({
  draft,
  onResourceChange,
  onCertificationHeldChange,
}: Step2Props) {
  const res = draft.resource;

  function setType(type: ResourceType) {
    if (type === res.type) return;
    onResourceChange({
      type,
      refId: null,
      name: "",
      monthlyCost: null,
      manualCost: false,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">Resource</h2>
          <p className="mt-1 text-sm text-muted">
            Choose whether this is an internal employee or an external supplier.
          </p>
        </div>

        <SegmentedControl<ResourceType>
          ariaLabel="Resource type"
          value={res.type}
          onChange={setType}
          options={[
            { value: "Internal", label: "Internal" },
            { value: "External", label: "External" },
          ]}
        />

        {res.type === "Internal" ? (
          <InternalPicker draft={draft} onResourceChange={onResourceChange} />
        ) : (
          <ExternalPicker draft={draft} onResourceChange={onResourceChange} />
        )}
      </section>

      {draft.requirement.certificationRequired && (
        <section className="flex flex-col gap-3 border-t border-border pt-6">
          <h3 className="text-sm font-semibold text-ink">Certification</h3>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={draft.requirement.certificationHeld}
              onChange={(e) => onCertificationHeldChange(e.target.checked)}
              className="h-4 w-4 rounded-sm border-border text-accent focus:ring-accent-light"
            />
            Candidate holds required certification?
          </label>
        </section>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="h-3 w-3 flex-none fill-current"
    >
      <path d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5A1.5 1.5 0 0 1 12.5 15h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm1.5-2v2h5V5a2.5 2.5 0 0 0-5 0Z" />
    </svg>
  );
}

function InternalPicker({
  draft,
  onResourceChange,
}: {
  draft: WizardDraft;
  onResourceChange: (patch: Partial<WizardResource>) => void;
}) {
  const [result, setResult] = useState<DirectoryResult<DirectoryEmployee> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const res = draft.resource;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchJson<DirectoryResult<DirectoryEmployee>>("/api/directory/employees");
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load employees.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedEmployee = result?.items.find((e) => e.id === res.refId) ?? null;

  return (
    <div className="flex flex-col gap-4">
      {result && (result.source === "mock" || result.degraded) && (
        <DirectoryBanner source={result.source} degraded={result.degraded} />
      )}
      {error && (
        <p role="alert" className="rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
          {error}
        </p>
      )}
      {loading && !result && <PickerSkeleton />}

      {res.refId && selectedEmployee && (
        <div className="ledger-card ledger-card--accent-left flex items-center justify-between gap-3 rounded-sm px-4 py-3">
          <div>
            <p className="text-sm font-medium text-ink">{selectedEmployee.name}</p>
            {selectedEmployee.designation && (
              <p className="text-xs text-muted">{selectedEmployee.designation}</p>
            )}
          </div>
          <span className="text-xs text-muted">Selected</span>
        </div>
      )}

      {result && (
        <ComboboxList
          items={result.items}
          getKey={(e) => e.id}
          getLabel={(e) => e.name}
          filterText={(e, q) =>
            e.name.toLowerCase().includes(q) || (e.designation ?? "").toLowerCase().includes(q)
          }
          ariaLabel="Search employees"
          placeholder="Search employees by name or designation…"
          emptyText="No employees match your search."
          onSelect={(e) =>
            onResourceChange({
              refId: e.id,
              name: e.name,
              monthlyCost: e.monthlyCost,
              manualCost: e.monthlyCost === null,
            })
          }
          renderItem={(e) => (
            <span className="flex w-full items-center justify-between gap-3">
              <span className="flex flex-col">
                <span>{e.name}</span>
                {e.designation && <span className="text-xs text-muted">{e.designation}</span>}
              </span>
              {e.monthlyCost === null ? (
                <span className="flex-none rounded-full bg-amber-light px-2 py-0.5 text-[11px] font-medium text-amber">
                  CTC missing
                </span>
              ) : (
                <span className="tnum flex flex-none items-center gap-1 text-xs text-muted">
                  <LockIcon />
                  internal
                </span>
              )}
            </span>
          )}
        />
      )}

      {res.refId && (res.manualCost || selectedEmployee?.monthlyCost === null) && (
        <ManualCostInput
          label="Monthly cost (required — CTC missing for this employee)"
          value={res.monthlyCost}
          onChange={(v) => onResourceChange({ monthlyCost: v, manualCost: true })}
        />
      )}
    </div>
  );
}

function ExternalPicker({
  draft,
  onResourceChange,
}: {
  draft: WizardDraft;
  onResourceChange: (patch: Partial<WizardResource>) => void;
}) {
  const [result, setResult] = useState<DirectoryResult<DirectorySupplier> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const res = draft.resource;
  const newVendorSelected = res.manualCost && res.refId === null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchJson<DirectoryResult<DirectorySupplier>>("/api/directory/suppliers");
        if (!cancelled) setResult(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load suppliers.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedSupplier = result?.items.find((s) => s.id === res.refId) ?? null;

  const items: (DirectorySupplier | typeof NEW_VENDOR_KEY)[] = result
    ? [...result.items, NEW_VENDOR_KEY]
    : [];

  return (
    <div className="flex flex-col gap-4">
      {result && (result.source === "mock" || result.degraded) && (
        <DirectoryBanner source={result.source} degraded={result.degraded} />
      )}
      {error && (
        <p role="alert" className="rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
          {error}
        </p>
      )}
      {loading && !result && <PickerSkeleton />}

      {res.refId && selectedSupplier && (
        <div className="ledger-card ledger-card--accent-left flex items-center justify-between gap-3 rounded-sm px-4 py-3">
          <p className="text-sm font-medium text-ink">{selectedSupplier.name}</p>
          <span className="text-xs text-muted">Selected</span>
        </div>
      )}

      {newVendorSelected && (
        <div className="ledger-card ledger-card--accent-left flex items-center justify-between gap-3 rounded-sm px-4 py-3">
          <p className="text-sm font-medium text-ink">New vendor</p>
          <span className="text-xs text-muted">Selected</span>
        </div>
      )}

      {result && (
        <ComboboxList
          items={items}
          getKey={(item) => (item === NEW_VENDOR_KEY ? NEW_VENDOR_KEY : item.id)}
          getLabel={(item) => (item === NEW_VENDOR_KEY ? "New vendor" : item.name)}
          filterText={(item, q) =>
            item === NEW_VENDOR_KEY ? "new vendor".includes(q) : item.name.toLowerCase().includes(q)
          }
          ariaLabel="Search suppliers"
          placeholder="Search suppliers by name, or add a new vendor…"
          emptyText="No suppliers match your search."
          onSelect={(item) => {
            if (item === NEW_VENDOR_KEY) {
              onResourceChange({ refId: null, name: "", monthlyCost: null, manualCost: true });
            } else {
              onResourceChange({
                refId: item.id,
                name: item.name,
                monthlyCost: item.monthlyRate,
                manualCost: item.monthlyRate === null,
              });
            }
          }}
          renderItem={(item) =>
            item === NEW_VENDOR_KEY ? (
              <span className="flex items-center gap-2 font-medium text-accent">
                <span aria-hidden="true">+</span> New vendor
              </span>
            ) : (
              <span className="flex w-full items-center justify-between gap-3">
                <span>{item.name}</span>
                {item.monthlyRate === null ? (
                  <span className="flex-none rounded-full bg-amber-light px-2 py-0.5 text-[11px] font-medium text-amber">
                    rate missing
                  </span>
                ) : (
                  <span className="tnum flex flex-none items-center gap-1 text-xs text-muted">
                    <LockIcon />
                    internal
                  </span>
                )}
              </span>
            )
          }
        />
      )}

      {newVendorSelected && (
        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Vendor name
            </span>
            <input
              type="text"
              value={res.name}
              onChange={(e) => onResourceChange({ name: e.target.value })}
              className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
            />
          </label>
          <ManualCostInput
            label="Monthly cost"
            value={res.monthlyCost}
            onChange={(v) => onResourceChange({ monthlyCost: v })}
          />
        </div>
      )}

      {res.refId && res.manualCost && selectedSupplier?.monthlyRate === null && (
        <ManualCostInput
          label="Monthly rate (required — rate missing for this supplier)"
          value={res.monthlyCost}
          onChange={(v) => onResourceChange({ monthlyCost: v, manualCost: true })}
        />
      )}
    </div>
  );
}

function ManualCostInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <label className="flex flex-1 flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        required
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="tnum w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
      />
    </label>
  );
}

function PickerSkeleton() {
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
