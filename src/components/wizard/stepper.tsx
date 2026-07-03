import { STEP_LABELS } from "@/components/wizard/types";

interface StepperProps {
  current: number;
  furthestValidStep: number;
  onJump: (step: number) => void;
}

export default function Stepper({ current, furthestValidStep, onJump }: StepperProps) {
  return (
    <ol className="flex w-full items-stretch gap-2 sm:gap-3" aria-label="Quote creation steps">
      {STEP_LABELS.map((label, i) => {
        const isCurrent = i === current;
        const isComplete = i < current;
        const clickable = i <= furthestValidStep && i !== current;
        return (
          <li key={label} className="flex flex-1 flex-col gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(i)}
              aria-current={isCurrent ? "step" : undefined}
              className={`h-1.5 w-full rounded-full transition duration-150 ${
                isCurrent || isComplete ? "bg-accent" : "bg-border"
              } ${clickable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
            />
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump(i)}
              className={`flex items-baseline gap-1.5 text-left text-xs font-medium uppercase tracking-wide transition duration-150 ${
                isCurrent ? "text-ink" : isComplete ? "text-accent" : "text-muted"
              } ${clickable ? "cursor-pointer hover:text-accent" : "cursor-default"}`}
            >
              <span className="tnum">{i + 1}.</span>
              <span className="normal-case tracking-normal">{label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
