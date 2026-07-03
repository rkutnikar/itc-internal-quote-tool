"use client";

import { useId, useMemo, useState } from "react";

interface ComboboxListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  filterText: (item: T, query: string) => boolean;
  renderItem: (item: T, active: boolean) => React.ReactNode;
  onSelect: (item: T) => void;
  placeholder?: string;
  emptyText?: string;
  ariaLabel: string;
  maxHeightClassName?: string;
}

/**
 * A simple, keyboard-navigable filterable list ("combobox-lite"): a text
 * input filters a list rendered below it. Not a native <select>, so full
 * ARIA combobox semantics are provided manually.
 */
export default function ComboboxList<T>({
  items,
  getKey,
  getLabel,
  filterText,
  renderItem,
  onSelect,
  placeholder = "Search…",
  emptyText = "No matches.",
  ariaLabel,
  maxHeightClassName = "max-h-72",
}: ComboboxListProps<T>) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    return items.filter((item) => filterText(item, query.trim().toLowerCase()));
  }, [items, query, filterText]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[activeIndex] ?? filtered[0];
      if (item) onSelect(item);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        role="combobox"
        aria-expanded="true"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(-1);
        }}
        onKeyDown={handleKeyDown}
        className="w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
      />
      <ul
        id={listboxId}
        role="listbox"
        aria-label={ariaLabel}
        className={`flex flex-col gap-1 overflow-y-auto rounded-sm border border-border bg-surface p-1.5 ${maxHeightClassName}`}
      >
        {filtered.length === 0 && (
          <li className="px-3 py-4 text-center text-sm text-muted">{emptyText}</li>
        )}
        {filtered.map((item, i) => (
          <li key={getKey(item)} role="option" aria-selected={i === activeIndex}>
            <button
              type="button"
              onClick={() => onSelect(item)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full rounded-sm px-3 py-2 text-left text-sm transition duration-100 ${
                i === activeIndex ? "bg-accent-light text-accent" : "text-ink hover:bg-paper"
              }`}
            >
              {renderItem(item, i === activeIndex)}
            </button>
          </li>
        ))}
      </ul>
      {/* Fallback label reference for screen readers wanting the plain label */}
      <span className="sr-only">{items.map(getLabel).join(", ")}</span>
    </div>
  );
}
