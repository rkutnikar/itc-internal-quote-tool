import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import SidebarNav from "@/components/sidebar-nav";
import LogoutButton from "@/components/logout-button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await requireSession())) redirect("/login");

  return (
    <div className="flex min-h-screen w-full flex-col bg-paper lg:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-60 lg:flex-col lg:border-r lg:border-border lg:bg-surface lg:px-4 lg:py-6">
        <div className="ledger-stamp mb-8 text-center text-xs text-ink">
          ITC
          <span className="block font-display text-sm normal-case tracking-normal">
            Quote Tool
          </span>
        </div>
        <SidebarNav orientation="vertical" />
        <div className="mt-auto pt-4">
          <LogoutButton />
        </div>
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
        <div className="ledger-stamp flex-none px-2 text-[10px] text-ink">
          ITC
        </div>
        <SidebarNav orientation="horizontal" />
        <LogoutButton variant="compact" />
      </header>

      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:ml-60 lg:px-14 lg:py-12">
        <div className="mx-auto max-w-5xl animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
