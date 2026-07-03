import Link from "next/link";

export const metadata = {
  title: "Not found — ITC Quote Tool",
};

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-1 flex-col items-center justify-center overflow-hidden bg-paper px-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 banknote-rule" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 banknote-rule" />

      <div className="w-full max-w-sm animate-rise text-center">
        <p className="ledger-stamp inline-block px-4 text-xs text-ink">404</p>
        <h1 className="mt-6 font-display text-4xl font-semibold tracking-tight text-ink">
          Page not in the ledger
        </h1>
        <p className="mt-2 text-sm text-muted">
          This entry doesn&rsquo;t exist, or it&rsquo;s been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-sm bg-accent px-4 py-2.5 text-sm font-medium text-paper transition duration-150 hover:bg-accent/90"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
