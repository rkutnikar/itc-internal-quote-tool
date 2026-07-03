interface ResumeDraftBarProps {
  onResume: () => void;
  onDiscard: () => void;
}

export default function ResumeDraftBar({ onResume, onDiscard }: ResumeDraftBarProps) {
  return (
    <div className="ledger-card ledger-card--accent-left flex flex-wrap items-center justify-between gap-3 rounded-sm px-5 py-3.5">
      <p className="text-sm text-ink">
        <span className="font-medium">Resume draft?</span>{" "}
        <span className="text-muted">You have an unfinished quote saved on this device.</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onDiscard}
          className="rounded-sm border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-warning hover:text-warning"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onResume}
          className="rounded-sm bg-accent px-3 py-1.5 text-xs font-medium text-paper transition hover:bg-accent/90"
        >
          Resume draft
        </button>
      </div>
    </div>
  );
}
