import Link from "next/link";

export const metadata = {
  title: "Not found — ITC Quote Tool",
};

export default function AppNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="ledger-stamp px-4 text-xs text-ink">404</div>
      <div>
        <p className="font-display text-3xl font-semibold text-ink">
          Page not in the ledger
        </p>
        <p className="mt-2 max-w-sm text-sm text-muted">
          This entry doesn&rsquo;t exist, or it&rsquo;s been moved.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
