import Link from "next/link";

interface DirectoryBannerProps {
  source: "frappe" | "mock";
  degraded?: string;
}

export default function DirectoryBanner({ source, degraded }: DirectoryBannerProps) {
  if (degraded) {
    return (
      <p className="rounded-sm bg-amber-light px-4 py-2.5 text-xs text-amber">
        Frappe unreachable — showing cached/sample data.
      </p>
    );
  }
  if (source === "mock") {
    return (
      <p className="rounded-sm bg-paper px-4 py-2.5 text-xs text-muted">
        Sample data — connect Frappe in{" "}
        <Link href="/settings" className="font-medium text-accent underline underline-offset-2">
          Settings
        </Link>{" "}
        to load your real directory.
      </p>
    );
  }
  return null;
}
