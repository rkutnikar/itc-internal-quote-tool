"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJson } from "@/components/use-api";

type QuoteStatus = "Generated" | "Sent" | "Approved" | "Rejected" | "Expired";

interface DashboardStats {
  kpis: {
    quotesThisMonth: number;
    pipelineValue: number;
    winRatePct: number | null;
    avgMarkupPct: number | null;
  };
  funnel: { status: QuoteStatus; count: number; value: number }[];
  monthly: { month: string; count: number; value: number }[];
  currency: string;
  degraded?: string;
}

const CHECKLIST = [
  "Configure Frappe in Settings",
  "Run connection test",
  "Create your first quote",
];

const FUNNEL_COLORS: Record<QuoteStatus, string> = {
  Generated: "bg-accent-light",
  Sent: "bg-accent/40",
  Approved: "bg-accent",
  Rejected: "bg-warning",
  Expired: "bg-border",
};

const FUNNEL_TEXT: Record<QuoteStatus, string> = {
  Generated: "text-accent",
  Sent: "text-accent",
  Approved: "text-paper",
  Rejected: "text-paper",
  Expired: "text-muted",
};

const MONTH_ABBREV = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Compact currency formatting. INR gets bespoke Lakh/Crore notation;
 * every other currency falls back to Intl's compact notation.
 */
function formatCompactCurrency(value: number, currency: string): string {
  if (currency === "INR") {
    const symbol = "₹";
    if (value >= 1e7) return `${symbol}${trimDecimal(value / 1e7)}Cr`;
    if (value >= 1e5) return `${symbol}${trimDecimal(value / 1e5)}L`;
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${symbol}${Math.round(value)}`;
    }
  }
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

function trimDecimal(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    document.title = "Dashboard — ITC Quote Tool";
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await fetchJson<DashboardStats>("/api/stats");
        if (!cancelled) setStats(json);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load stats.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [retryTick]);

  const neverHadQuotes =
    !!stats && stats.funnel.every((f) => f.count === 0) && stats.kpis.quotesThisMonth === 0;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Overview</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-ink">
            Dashboard
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

      {stats?.degraded && (
        <p className="rounded-sm bg-amber-light px-4 py-2.5 text-xs text-amber">
          Frappe unreachable — showing local data only.
        </p>
      )}

      {loading && !stats && <KpiSkeleton />}

      {stats && <KpiRow stats={stats} />}

      {loading && !stats && <PanelSkeleton />}

      {stats && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FunnelPanel funnel={stats.funnel} currency={stats.currency} />
          <MonthlyTrendPanel monthly={stats.monthly} currency={stats.currency} />
        </div>
      )}

      {neverHadQuotes && <GetConnectedPanel />}
    </div>
  );
}

function KpiRow({ stats }: { stats: DashboardStats }) {
  const winRateValue =
    stats.kpis.winRatePct === null ? "—" : `${stats.kpis.winRatePct.toFixed(1)}%`;
  const avgMarkupValue =
    stats.kpis.avgMarkupPct === null ? "—" : `${stats.kpis.avgMarkupPct.toFixed(1)}%`;

  const cards = [
    {
      label: "Quotes this month",
      value: String(stats.kpis.quotesThisMonth),
      subtitle: stats.kpis.quotesThisMonth === 0 ? "No quotes yet this month" : "Created this month",
    },
    {
      label: "Pipeline value",
      value: formatCompactCurrency(stats.kpis.pipelineValue, stats.currency),
      subtitle: "Generated + Sent",
    },
    {
      label: "Win rate",
      value: winRateValue,
      subtitle: stats.kpis.winRatePct === null ? "No decisions yet" : "Approved vs. rejected",
    },
    {
      label: "Avg markup",
      value: avgMarkupValue,
      subtitle: stats.kpis.avgMarkupPct === null ? "No priced quotes yet" : "Over resource cost",
    },
  ];

  return (
    <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((stat) => (
        <div key={stat.label} className="ledger-card rounded-sm p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{stat.label}</p>
          <p className="tnum mt-3 font-display text-4xl font-semibold text-ink">{stat.value}</p>
          <p className="mt-2 text-xs text-muted">{stat.subtitle}</p>
        </div>
      ))}
    </div>
  );
}

function FunnelPanel({
  funnel,
  currency,
}: {
  funnel: DashboardStats["funnel"];
  currency: string;
}) {
  const max = Math.max(1, ...funnel.map((f) => f.count));
  return (
    <section className="ledger-card animate-rise rounded-sm p-6">
      <h2 className="font-display text-xl font-semibold text-ink">Status funnel</h2>
      <div className="mt-5 flex flex-col gap-3">
        {funnel.map((row) => {
          const widthPct = Math.max((row.count / max) * 100, row.count > 0 ? 4 : 0);
          return (
            <div key={row.status} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-ink">{row.status}</span>
                <span className="tnum text-muted">
                  {row.count} &middot; {formatCompactCurrency(row.value, currency)}
                </span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded-sm bg-paper">
                <div
                  className={`flex h-full items-center rounded-sm ${FUNNEL_COLORS[row.status]} transition-all duration-500`}
                  style={{ width: `${widthPct}%`, minWidth: row.count > 0 ? "1.5rem" : 0 }}
                >
                  {row.count > 0 && widthPct > 12 && (
                    <span className={`tnum px-2 text-[11px] font-medium ${FUNNEL_TEXT[row.status]}`}>
                      {row.count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MonthlyTrendPanel({
  monthly,
  currency,
}: {
  monthly: DashboardStats["monthly"];
  currency: string;
}) {
  const max = Math.max(1, ...monthly.map((m) => m.value));
  return (
    <section className="ledger-card animate-rise rounded-sm p-6">
      <h2 className="font-display text-xl font-semibold text-ink">Monthly trend</h2>
      <div className="mt-6 flex items-end justify-between gap-3 px-1" style={{ height: "10rem" }}>
        {monthly.map((m) => {
          const heightPct = m.value > 0 ? Math.max((m.value / max) * 100, 4) : 0;
          const [year, monthNum] = m.month.split("-");
          const label = MONTH_ABBREV[Number(monthNum) - 1] ?? m.month;
          return (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
              <span className="tnum text-[11px] text-muted">{m.count > 0 ? m.count : ""}</span>
              <div className="flex w-full flex-1 items-end">
                {m.value > 0 ? (
                  <div
                    className="w-full rounded-t-sm bg-accent transition-all duration-500"
                    style={{ height: `${heightPct}%` }}
                    title={`${label} ${year}: ${formatCompactCurrency(m.value, currency)}`}
                  />
                ) : (
                  <div className="h-[2px] w-full rounded-full bg-border" />
                )}
              </div>
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GetConnectedPanel() {
  return (
    <section className="ledger-card animate-rise rounded-sm p-8">
      <p className="text-xs font-medium uppercase tracking-wide text-accent">Get connected</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-ink">
        Three steps to your first quote
      </h2>
      <ol className="mt-5 flex flex-col gap-3">
        {CHECKLIST.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-sm text-ink">
            <span className="tnum flex h-6 w-6 flex-none items-center justify-center rounded-full border border-border bg-paper text-xs font-medium text-muted">
              {i + 1}
            </span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
      <Link
        href="/settings"
        className="mt-6 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90"
      >
        Go to Settings
      </Link>
    </section>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-sm border border-border bg-border/20" />
      ))}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {[0, 1].map((i) => (
        <div key={i} className="h-64 animate-pulse rounded-sm border border-border bg-border/20" />
      ))}
    </div>
  );
}
