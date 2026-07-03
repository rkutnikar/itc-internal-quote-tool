"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PriorityChip from "@/components/wizard/priority-chip";
import { makeCurrencyFormatter } from "@/components/wizard/format";
import { priorityKeyFromValue } from "@/lib/pricing";
import { fetchJson } from "@/components/use-api";

type QuoteStatus = "Draft" | "Generated" | "Sent" | "Approved" | "Rejected" | "Expired";

interface QuoteListItem {
  id: string;
  storage: "frappe" | "local";
  status: string;
  createdAt: string;
  validUntil: string;
  customerName: string;
  priorityRaw: string;
  resourceName: string;
  resourceType: "Internal" | "External";
  finalMonthlyRate: number;
  totalContractValue: number;
  currency: string;
}

const STATUS_FILTERS: QuoteStatus[] = ["Generated", "Sent", "Approved", "Rejected", "Expired"];

function isExpiredRow(status: string, validUntil: string): boolean {
  if (status === "Expired") return true;
  if (status !== "Generated" && status !== "Sent") return false;
  if (!validUntil) return false;
  return validUntil < new Date().toISOString().slice(0, 10);
}

interface QuotesResponse {
  items: QuoteListItem[];
  degraded?: string;
}

export default function QuotesListPage() {
  const [data, setData] = useState<QuotesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "All">("All");
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    document.title = "Quotes — ITC Quote Tool";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await fetchJson<QuotesResponse>("/api/quotes");
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load quotes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const filteredItems = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "All") return data.items;
    return data.items.filter((q) => q.status === statusFilter);
  }, [data, statusFilter]);

  const counts = useMemo(() => {
    const c: Partial<Record<QuoteStatus | "All", number>> = { All: data?.items.length ?? 0 };
    for (const status of STATUS_FILTERS) {
      c[status] = data?.items.filter((q) => q.status === status).length ?? 0;
    }
    return c;
  }, [data]);

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Ledger</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">
            Quotes
          </h1>
        </div>
        <Link
          href="/quotes/new"
          className="inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90"
        >
          New quote
        </Link>
      </header>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-sm bg-warning-light px-4 py-3 text-sm text-warning">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="inline-flex items-center justify-center rounded-sm border border-warning px-3 py-1.5 text-xs font-medium text-warning transition hover:bg-warning hover:text-paper"
          >
            Retry
          </button>
        </div>
      )}

      {data?.degraded && (
        <p className="rounded-sm bg-amber-light px-4 py-2.5 text-xs text-amber">
          Frappe unreachable — showing cached/local quotes only.
        </p>
      )}

      {loading && !data && <TableSkeleton />}

      {data && data.items.length === 0 && <EmptyState />}

      {data && data.items.length > 0 && (
        <>
          <StatusFilterChips
            counts={counts}
            active={statusFilter}
            onChange={setStatusFilter}
          />
          {filteredItems.length > 0 ? (
            <QuotesTable items={filteredItems} />
          ) : (
            <p className="rounded-sm border border-dashed border-border px-5 py-8 text-center text-sm text-muted">
              No quotes with status &ldquo;{statusFilter}&rdquo;.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatusFilterChips({
  counts,
  active,
  onChange,
}: {
  counts: Partial<Record<QuoteStatus | "All", number>>;
  active: QuoteStatus | "All";
  onChange: (status: QuoteStatus | "All") => void;
}) {
  const options: (QuoteStatus | "All")[] = ["All", ...STATUS_FILTERS];
  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
      {options.map((status) => {
        const isActive = status === active;
        return (
          <button
            key={status}
            type="button"
            onClick={() => onChange(status)}
            aria-pressed={isActive}
            className={`tnum inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "border-accent bg-accent text-paper"
                : "border-border bg-surface text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {status}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                isActive ? "bg-paper/20 text-paper" : "bg-paper text-muted"
              }`}
            >
              {counts[status] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function QuotesTable({ items }: { items: QuoteListItem[] }) {
  return (
    <div className="ledger-card overflow-x-auto rounded-sm">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
            <th className="px-5 py-3">Quote #</th>
            <th className="px-5 py-3">Customer</th>
            <th className="px-5 py-3">Resource</th>
            <th className="px-5 py-3 text-right">Monthly rate</th>
            <th className="px-5 py-3 text-right">Total</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Created</th>
            <th className="px-5 py-3">Valid until</th>
          </tr>
        </thead>
        <tbody>
          {items.map((q) => {
            const formatter = makeCurrencyFormatter(q.currency);
            const created = q.createdAt ? new Date(q.createdAt) : null;
            const validUntil = q.validUntil ? new Date(q.validUntil) : null;
            const expired = isExpiredRow(q.status, q.validUntil);
            return (
              <tr
                key={q.id}
                className={`border-b border-border last:border-b-0 transition hover:bg-paper ${
                  expired ? "text-muted" : ""
                }`}
              >
                <td className="px-5 py-3.5">
                  <Link
                    href={`/quotes/${q.id}`}
                    className="font-medium text-accent underline-offset-2 hover:underline"
                  >
                    {q.id}
                  </Link>
                  {q.storage === "local" && (
                    <span
                      title="Saved locally — not yet in Frappe"
                      className="ml-2 inline-flex rounded-full bg-paper px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted"
                    >
                      local
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <PriorityChip priorityKey={priorityKeyFromValue(q.priorityRaw)} />
                    <span className={expired ? "text-muted" : "text-ink"}>{q.customerName}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className={expired ? "text-muted" : "text-ink"}>{q.resourceName}</span>
                    <span
                      className={`inline-flex flex-none rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                        q.resourceType === "Internal"
                          ? "bg-accent-light text-accent"
                          : "bg-paper text-muted"
                      }`}
                    >
                      {q.resourceType}
                    </span>
                  </div>
                </td>
                <td className={`tnum px-5 py-3.5 text-right ${expired ? "text-muted" : "text-ink"}`}>
                  {formatter.format(q.finalMonthlyRate)}
                </td>
                <td className={`tnum px-5 py-3.5 text-right ${expired ? "text-muted" : "text-ink"}`}>
                  {formatter.format(q.totalContractValue)}
                </td>
                <td className="px-5 py-3.5">
                  <StatusPill status={q.status} />
                </td>
                <td className="tnum px-5 py-3.5 text-muted">
                  {created ? created.toLocaleDateString("en-IN") : "—"}
                </td>
                <td className={`tnum px-5 py-3.5 ${expired ? "text-muted" : "text-ink"}`}>
                  {validUntil ? validUntil.toLocaleDateString("en-IN") : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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

function EmptyState() {
  return (
    <div className="ledger-card flex flex-col items-center gap-4 rounded-sm px-8 py-16 text-center">
      <div className="ledger-stamp px-4 text-xs text-ink">No entries</div>
      <div>
        <p className="font-display text-2xl font-semibold text-ink">No quotes yet</p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          Quotes you generate will be recorded here, ledger-style, as they&rsquo;re created.
        </p>
      </div>
      <Link
        href="/quotes/new"
        className="mt-2 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90"
      >
        Create your first quote
      </Link>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="ledger-card flex flex-col gap-3 rounded-sm p-6">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 w-full animate-pulse rounded-sm bg-border/30" />
      ))}
    </div>
  );
}
