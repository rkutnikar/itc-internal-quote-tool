import { listQuotes, type QuoteListItem, type QuoteStatus } from "./quotes";

/**
 * Dashboard aggregates, computed on the fly from the quote list (local +
 * Frappe). Volumes are small (hundreds of quotes) — no caching needed.
 */

export interface DashboardStats {
  kpis: {
    quotesThisMonth: number;
    /** Sum of total contract value for open quotes (Generated + Sent). */
    pipelineValue: number;
    /** Approved / (Approved + Rejected); null until at least one decided. */
    winRatePct: number | null;
    /** Average markup of final rate over cost; null with no priceable rows. */
    avgMarkupPct: number | null;
  };
  funnel: { status: QuoteStatus; count: number; value: number }[];
  /** Last 6 calendar months, oldest first. */
  monthly: { month: string; count: number; value: number }[];
  currency: string;
  degraded?: string;
}

const FUNNEL_ORDER: QuoteStatus[] = [
  "Generated",
  "Sent",
  "Approved",
  "Rejected",
  "Expired",
];

export async function computeStats(): Promise<DashboardStats> {
  const { items, degraded } = await listQuotes();
  const now = new Date();
  const thisMonth = now.toISOString().slice(0, 7);

  const kpis = {
    quotesThisMonth: items.filter((q) => q.createdAt.slice(0, 7) === thisMonth).length,
    pipelineValue: sum(
      items.filter((q) => q.status === "Generated" || q.status === "Sent"),
      (q) => q.totalContractValue
    ),
    winRatePct: winRate(items),
    avgMarkupPct: avgMarkup(items),
  };

  const funnel = FUNNEL_ORDER.map((status) => {
    const rows = items.filter((q) => q.status === status);
    return { status, count: rows.length, value: sum(rows, (q) => q.totalContractValue) };
  });

  const monthly: DashboardStats["monthly"] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const rows = items.filter((q) => q.createdAt.slice(0, 7) === key);
    monthly.push({
      month: key,
      count: rows.length,
      value: sum(rows, (q) => q.totalContractValue),
    });
  }

  return {
    kpis,
    funnel,
    monthly,
    currency: items[0]?.currency ?? "INR",
    degraded,
  };
}

function sum(rows: QuoteListItem[], pick: (q: QuoteListItem) => number): number {
  return rows.reduce((acc, q) => acc + pick(q), 0);
}

function winRate(items: QuoteListItem[]): number | null {
  const approved = items.filter((q) => q.status === "Approved").length;
  const rejected = items.filter((q) => q.status === "Rejected").length;
  if (approved + rejected === 0) return null;
  return Math.round((approved / (approved + rejected)) * 1000) / 10;
}

function avgMarkup(items: QuoteListItem[]): number | null {
  const priceable = items.filter((q) => q.monthlyCost > 0 && q.finalMonthlyRate > 0);
  if (priceable.length === 0) return null;
  const total = priceable.reduce(
    (acc, q) => acc + ((q.finalMonthlyRate - q.monthlyCost) / q.monthlyCost) * 100,
    0
  );
  return Math.round((total / priceable.length) * 10) / 10;
}
