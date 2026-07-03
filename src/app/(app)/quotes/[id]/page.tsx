"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import type { Tier } from "@/lib/pricing";
import PriorityChip from "@/components/wizard/priority-chip";
import { makeCurrencyFormatter } from "@/components/wizard/format";
import { fetchJson } from "@/components/use-api";

interface QuoteRecord {
  id: string;
  storage: "frappe" | "local";
  status: string;
  createdAt: string;
  validUntil: string;
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
  sheet: {
    minBill: number;
    tiers: Record<Tier, { monthly: number; total: number; marginPct: number }>;
  };
  finalMonthlyRate: number;
  totalContractValue: number;
  currency: string;
}

const TIER_LABEL: Record<Tier, string> = { good: "Good", better: "Better", best: "Best" };

type QuoteStatus = "Draft" | "Generated" | "Sent" | "Approved" | "Rejected" | "Expired";

const NEXT_STATUSES: Record<QuoteStatus, ("Sent" | "Approved" | "Rejected")[]> = {
  Draft: [],
  Generated: ["Sent", "Approved", "Rejected"],
  Sent: ["Approved", "Rejected"],
  Approved: [],
  Rejected: [],
  Expired: [],
};

type PatchState =
  | { status: "idle" }
  | { status: "submitting"; target: "Sent" | "Approved" | "Rejected" }
  | { status: "error"; message: string };

export default function QuoteDetailPage() {
  const params = useParams<{ id: string }>();
  const [quote, setQuote] = useState<QuoteRecord | null>(null);
  const [error, setError] = useState<{ message: string; isNotFound: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [patchState, setPatchState] = useState<PatchState>({ status: "idle" });
  const [confirmingReject, setConfirmingReject] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    document.title = quote ? `${quote.id} — ITC Quote Tool` : "Quote — ITC Quote Tool";
  }, [quote]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/quotes/${encodeURIComponent(params.id)}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          window.location.assign("/login");
          return;
        }
        const data = (await res.json().catch(() => null)) as (QuoteRecord & { error?: string }) | null;
        if (!res.ok || !data) {
          throw Object.assign(new Error(data?.error ?? "Quote not found."), {
            isNotFound: res.status === 404,
          });
        }
        if (!cancelled) setQuote(data);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to load quote.";
          const isNotFound = err instanceof Error && (err as Error & { isNotFound?: boolean }).isNotFound === true;
          setError({ message, isNotFound });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, retryTick]);

  async function applyStatus(next: "Sent" | "Approved" | "Rejected") {
    if (!quote) return;
    setPatchState({ status: "submitting", target: next });
    try {
      const data = await fetchJson<QuoteRecord>(`/api/quotes/${encodeURIComponent(quote.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setQuote(data);
      setPatchState({ status: "idle" });
      setConfirmingReject(false);
    } catch (err) {
      setPatchState({
        status: "error",
        message: err instanceof Error ? err.message : "Could not update status.",
      });
    }
  }

  const formatter = useMemo(() => makeCurrencyFormatter(quote?.currency ?? "INR"), [quote]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/quotes"
          className="text-xs font-medium text-muted underline-offset-2 hover:text-accent hover:underline"
        >
          &larr; Back to quotes
        </Link>
      </div>

      {loading && !quote && <DetailSkeleton />}

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
          <span>{error.message}</span>
          {!error.isNotFound && (
            <button
              type="button"
              onClick={() => setRetryTick((t) => t + 1)}
              className="inline-flex items-center justify-center rounded-sm border border-warning px-3 py-1.5 text-xs font-medium text-warning transition hover:bg-warning hover:text-paper"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {quote && (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Quote</p>
              <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">
                {quote.id}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusPill status={quote.status} />
                {quote.storage === "local" && (
                  <span
                    title="Saved locally — not yet in Frappe"
                    className="inline-flex rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted"
                  >
                    local
                  </span>
                )}
                <StatusActions
                  quote={quote}
                  patchState={patchState}
                  confirmingReject={confirmingReject}
                  onSetConfirmingReject={setConfirmingReject}
                  onApply={applyStatus}
                />
              </div>
              <div className="mt-2 text-xs text-muted">
                {quote.status === "Expired" ? (
                  <span>Expired automatically after the validity date.</span>
                ) : (
                  <span>
                    Valid until <span className="tnum font-medium text-ink">{formatDate(quote.validUntil)}</span>
                  </span>
                )}
              </div>
              {patchState.status === "error" && (
                <p role="alert" className="mt-2 rounded-sm bg-warning-light px-3 py-2 text-xs text-warning">
                  {patchState.message}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/quotes/new?from=${encodeURIComponent(quote.id)}`}
                className="inline-flex items-center gap-2 rounded-sm border border-border px-4 py-2.5 text-sm font-medium text-ink transition duration-150 hover:border-accent hover:text-accent"
              >
                Revise
              </Link>
              <a
                href={`/api/quotes/${encodeURIComponent(quote.id)}/pdf`}
                className="inline-flex items-center gap-2 rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90"
              >
                Download PDF
              </a>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="ledger-card rounded-sm p-6 lg:col-span-2">
              <h2 className="text-sm font-semibold text-ink">Customer</h2>
              <div className="mt-3 flex items-center gap-2">
                <PriorityChip priorityKey={quote.draft.customer.priorityKey} />
                <span className="text-sm font-medium text-ink">{quote.draft.customer.name}</span>
                <span className="text-xs text-muted">({quote.draft.customer.priorityRaw})</span>
              </div>
            </div>

            <div className="ledger-card rounded-sm p-6">
              <h2 className="text-sm font-semibold text-ink">Validity</h2>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <Field label="Created" value={formatDate(quote.createdAt)} />
                <Field label="Valid until" value={formatDate(quote.validUntil)} />
              </dl>
            </div>

            <div className="ledger-card rounded-sm p-6 lg:col-span-3">
              <h2 className="text-sm font-semibold text-ink">Requirement</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <Field label="Experience" value={`${quote.draft.requirement.yearsExperience} yrs`} />
                <Field label="Skill type" value={quote.draft.requirement.skillType} />
                <Field label="Duration" value={`${quote.draft.requirement.durationMonths} mo`} />
                <Field
                  label="Budget/mo"
                  value={
                    quote.draft.requirement.budgetPerMonth !== null
                      ? formatter.format(quote.draft.requirement.budgetPerMonth)
                      : "Not set"
                  }
                />
                <Field
                  label="Certification required"
                  value={quote.draft.requirement.certificationRequired ? "Yes" : "No"}
                />
                {quote.draft.requirement.certificationRequired && (
                  <Field
                    label="Certification held"
                    value={quote.draft.requirement.certificationHeld ? "Yes" : "No"}
                  />
                )}
              </dl>
            </div>

            <div className="ledger-card rounded-sm p-6 lg:col-span-3">
              <h2 className="text-sm font-semibold text-ink">Resource</h2>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <Field label="Type" value={quote.draft.resource.type} />
                <Field label="Name" value={quote.draft.resource.name} />
                <Field
                  label={
                    <span className="flex items-center gap-1">
                      Monthly cost
                      <span
                        title="Internal only — never shown to the client"
                        className="rounded-full bg-amber-light px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber"
                      >
                        internal
                      </span>
                    </span>
                  }
                  value={formatter.format(quote.draft.resource.monthlyCost)}
                />
                <Field label="Cost source" value={quote.draft.resource.manualCost ? "Manual entry" : "Directory"} />
              </dl>
            </div>

            <div className="ledger-card rounded-sm p-6 lg:col-span-3">
              <h2 className="text-sm font-semibold text-ink">Pricing</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(["good", "better", "best"] as const).map((tier) => {
                  const t = quote.sheet.tiers[tier];
                  const selected = quote.draft.selection.tier === tier;
                  return (
                    <div
                      key={tier}
                      className={`rounded-sm border p-4 ${
                        selected ? "border-accent ring-2 ring-accent ring-offset-2 ring-offset-paper" : "border-border"
                      }`}
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-muted">
                        {TIER_LABEL[tier]}
                      </p>
                      <p className="tnum mt-1 font-display text-2xl font-semibold text-ink">
                        {formatter.format(t.monthly)}
                      </p>
                      <p className="tnum mt-1 text-xs text-muted">
                        {formatter.format(t.total)} total &middot; {t.marginPct.toFixed(1)}% margin
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Final rate {quote.draft.selection.tier === "custom" && "(custom)"}
                  </p>
                  <p className="tnum mt-1 font-display text-3xl font-semibold text-ink">
                    {formatter.format(quote.finalMonthlyRate)}
                    <span className="ml-1 text-sm font-normal text-muted">/mo</span>
                  </p>
                </div>
                <div className="flex gap-6 text-right">
                  <Field label="Total contract value" value={formatter.format(quote.totalContractValue)} />
                  <Field label="Minimum bill" value={formatter.format(quote.sheet.minBill)} />
                </div>
              </div>
            </div>

            <div className="ledger-card rounded-sm p-6 lg:col-span-3">
              <h2 className="text-sm font-semibold text-ink">Prepared by</h2>
              <p className="mt-2 text-sm text-ink">{quote.draft.preparedBy || "—"}</p>
              {quote.draft.notes && (
                <>
                  <h3 className="mt-4 text-sm font-semibold text-ink">Notes</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{quote.draft.notes}</p>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: "bg-paper text-muted",
    Generated: "bg-accent-light text-accent",
    Sent: "bg-accent-light text-accent",
    Approved: "bg-accent-light text-accent",
    Rejected: "bg-warning-light text-warning",
    Expired: "bg-amber-light text-amber",
  };
  const className = map[status] ?? "bg-paper text-muted";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-medium ${className}`}>
      {status}
    </span>
  );
}

function StatusActions({
  quote,
  patchState,
  confirmingReject,
  onSetConfirmingReject,
  onApply,
}: {
  quote: QuoteRecord;
  patchState: PatchState;
  confirmingReject: boolean;
  onSetConfirmingReject: (v: boolean) => void;
  onApply: (next: "Sent" | "Approved" | "Rejected") => void;
}) {
  const status = quote.status as QuoteStatus;
  const options = NEXT_STATUSES[status] ?? [];
  const busy = patchState.status === "submitting";

  if (options.length === 0) return null;

  if (confirmingReject) {
    return (
      <span className="inline-flex items-center gap-2 rounded-sm border border-warning/40 bg-warning-light px-2.5 py-1">
        <span className="text-xs text-warning">Reject this quote?</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply("Rejected")}
          className="rounded-sm bg-warning px-2.5 py-1 text-xs font-medium text-paper transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && patchState.status === "submitting" && patchState.target === "Rejected"
            ? "Rejecting…"
            : "Confirm reject"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetConfirmingReject(false)}
          className="rounded-sm px-2 py-1 text-xs font-medium text-muted transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      {options.includes("Sent") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply("Sent")}
          className="rounded-sm border border-accent px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && patchState.status === "submitting" && patchState.target === "Sent"
            ? "Marking sent…"
            : "Mark sent"}
        </button>
      )}
      {options.includes("Approved") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onApply("Approved")}
          className="rounded-sm bg-accent px-2.5 py-1 text-xs font-medium text-paper transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy && patchState.status === "submitting" && patchState.target === "Approved"
            ? "Approving…"
            : "Approve"}
        </button>
      )}
      {options.includes("Rejected") && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onSetConfirmingReject(true)}
          className="rounded-sm border border-warning px-2.5 py-1 text-xs font-medium text-warning transition hover:bg-warning-light disabled:cursor-not-allowed disabled:opacity-60"
        >
          Reject
        </button>
      )}
    </span>
  );
}

function Field({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="tnum text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-10 w-64 animate-pulse rounded-sm bg-border/30" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-sm border border-border bg-border/20" />
        ))}
      </div>
    </div>
  );
}
