export type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

export function SaveFeedback({ state }: { state: SaveState }) {
  if (state.status === "saved") {
    return (
      <p role="status" className="text-sm text-accent">
        Saved &#10003;
      </p>
    );
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="text-sm text-warning">
        {state.message}
      </p>
    );
  }
  return null;
}
