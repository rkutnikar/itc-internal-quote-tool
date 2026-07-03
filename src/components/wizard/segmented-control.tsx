interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-sm border border-border bg-paper p-1"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-sm px-4 py-1.5 text-sm font-medium transition duration-150 ${
              active
                ? "bg-accent text-paper shadow-sm"
                : "text-ink hover:bg-accent-light hover:text-accent"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
