"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, MapPin, Search, X } from "lucide-react";

import { useLoadingBar } from "@/components/loading";
import {
  DATE_POSTED_OPTIONS,
  EMPLOYMENT_TYPES,
  EXPERIENCE_LEVELS,
  WORK_MODES,
} from "@/features/jobs/filter-options";
import { jobsUrl, type JobFilters } from "@/features/jobs/filters";
import { KNOWN_CITIES } from "@/services/jobs/enrichment/cities";
import { cn } from "@/lib/utils";

/**
 * Roving keyboard navigation for a dropdown: ArrowDown/ArrowUp move focus
 * through the option buttons one at a time (wrapping around), Home/End
 * jump to the ends. Attach to the element wrapping the trigger + panel.
 */
export function handleDropdownArrowKeys(
  event: React.KeyboardEvent<HTMLElement>
) {
  const { key } = event;
  if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Home" && key !== "End") {
    return;
  }

  const container = event.currentTarget;
  const options = Array.from(
    container.querySelectorAll<HTMLElement>('[role="option"]')
  );
  if (options.length === 0) return;

  event.preventDefault();
  const currentIndex = options.findIndex((el) => el === document.activeElement);

  let nextIndex: number;
  if (key === "Home") {
    nextIndex = 0;
  } else if (key === "End") {
    nextIndex = options.length - 1;
  } else if (key === "ArrowDown") {
    nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
  } else {
    nextIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
  }

  options[nextIndex]?.focus();
}

type OptionFilterKey =
  | "experienceLevel"
  | "datePosted"
  | "workMode"
  | "employmentType";

type OptionFilterConfig = {
  key: OptionFilterKey;
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
};

const OPTION_FILTERS: OptionFilterConfig[] = [
  { key: "experienceLevel", label: "Experience", options: EXPERIENCE_LEVELS },
  { key: "datePosted", label: "Date posted", options: DATE_POSTED_OPTIONS },
  { key: "workMode", label: "Work mode", options: WORK_MODES },
  { key: "employmentType", label: "Employment type", options: EMPLOYMENT_TYPES },
];

type JobsFilterBarProps = {
  filters: JobFilters;
};

/**
 * LinkedIn-style compact filter row: each filter is a dropdown button
 * that applies instantly on selection (no separate "Apply" step). The
 * URL stays the single source of truth; navigation streams the results.
 */
export function JobsFilterBar({ filters }: JobsFilterBarProps) {
  const router = useRouter();
  const { startNavigation } = useLoadingBar();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const apply = useCallback(
    (patch: Partial<JobFilters>) => {
      startNavigation();
      router.push(jobsUrl({ ...filters, ...patch, page: 1 }));
      setOpenKey(null);
    },
    [filters, router, startNavigation]
  );

  // Close on outside click / Escape.
  useEffect(() => {
    if (!openKey) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpenKey(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  return (
    <div
      ref={containerRef}
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Job filters"
    >
      <LocationFilter
        value={filters.city}
        isOpen={openKey === "city"}
        onToggle={() => setOpenKey((key) => (key === "city" ? null : "city"))}
        onSelect={(city) => apply({ city })}
        onClear={() => apply({ city: undefined })}
      />

      {OPTION_FILTERS.map((filter) => {
        const activeId = filters[filter.key] as string | undefined;
        const activeOption = filter.options.find((o) => o.id === activeId);

        return (
          <OptionFilter
            key={filter.key}
            label={filter.label}
            options={filter.options}
            activeId={activeId}
            activeLabel={activeOption?.label}
            isOpen={openKey === filter.key}
            onToggle={() =>
              setOpenKey((key) => (key === filter.key ? null : filter.key))
            }
            onSelect={(id) =>
              apply({ [filter.key]: id } as Partial<JobFilters>)
            }
            onClear={() =>
              apply({ [filter.key]: undefined } as Partial<JobFilters>)
            }
          />
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trigger button shared by all dropdowns
// ---------------------------------------------------------------------------

type FilterTriggerProps = {
  active: boolean;
  isOpen: boolean;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
};

export function FilterTrigger({ active, isOpen, label, icon, onClick }: FilterTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-sm border px-3 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary hover:bg-primary/15"
          : "border-border/70 bg-background text-foreground hover:bg-muted/60",
        isOpen && !active && "border-foreground/40 bg-muted/60"
      )}
    >
      {icon}
      <span className="max-w-[12rem] truncate">{label}</span>
      <ChevronDown
        className={cn("size-3.5 opacity-60 transition-transform", isOpen && "rotate-180")}
      />
    </button>
  );
}

/** Popover panel anchored to a trigger; align right to avoid overflow. */
export function DropdownPanel({
  children,
  align = "left",
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <div
      role="listbox"
      className={cn(
        "absolute top-[calc(100%+0.375rem)] z-40 w-56 overflow-hidden rounded-sm border border-border/70 bg-popover p-1 shadow-lg",
        align === "right" ? "right-0" : "left-0",
        className
      )}
    >
      {children}
    </div>
  );
}

export function OptionRow({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted",
        selected && "font-medium text-primary"
      )}
    >
      <span className="truncate">{label}</span>
      {selected && <Check className="size-4 shrink-0" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Single-select option filter
// ---------------------------------------------------------------------------

type OptionFilterProps = {
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
  activeId?: string;
  activeLabel?: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
  onClear: () => void;
};

function OptionFilter({
  label,
  options,
  activeId,
  activeLabel,
  isOpen,
  onToggle,
  onSelect,
  onClear,
}: OptionFilterProps) {
  return (
    <div
      className="relative"
      onKeyDown={isOpen ? handleDropdownArrowKeys : undefined}
    >
      <FilterTrigger
        active={Boolean(activeId)}
        isOpen={isOpen}
        label={activeLabel ?? label}
        onClick={onToggle}
      />
      {isOpen && (
        <DropdownPanel>
          {options.map((option) => (
            <OptionRow
              key={option.id}
              selected={option.id === activeId}
              label={option.label}
              onClick={() => onSelect(option.id)}
            />
          ))}
          {activeId && (
            <>
              <div className="my-1 h-px bg-border/60" />
              <button
                type="button"
                onClick={onClear}
                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
                Clear
              </button>
            </>
          )}
        </DropdownPanel>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location filter with searchable city list
// ---------------------------------------------------------------------------

type LocationFilterProps = {
  value?: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (city: string) => void;
  onClear: () => void;
};

function LocationFilter({
  value,
  isOpen,
  onToggle,
  onSelect,
  onClear,
}: LocationFilterProps) {
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      // Focus the search box when the dropdown opens.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = query
      ? KNOWN_CITIES.filter(
          (city) =>
            city.name.toLowerCase().includes(query) ||
            city.aliases.some((alias) => alias.includes(query)) ||
            city.country.toLowerCase().includes(query)
        )
      : KNOWN_CITIES;
    return list.slice(0, 60);
  }, [search]);

  return (
    <div
      className="relative"
      onKeyDown={isOpen ? handleDropdownArrowKeys : undefined}
    >
      <FilterTrigger
        active={Boolean(value)}
        isOpen={isOpen}
        label={value ?? "Location"}
        icon={<MapPin className="size-3.5" />}
        onClick={onToggle}
      />
      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 top-[calc(100%+0.375rem)] z-40 w-64 overflow-hidden rounded-md border border-border/70 bg-popover shadow-lg"
        >
          <div className="relative border-b border-border/60 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search city..."
              className="h-8 w-full rounded-sm border border-input bg-transparent pl-8 pr-2 text-sm outline-none focus-visible:border-ring"
            />
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {matches.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-sm text-muted-foreground">
                No cities found.
              </p>
            ) : (
              matches.map((city) => (
                <OptionRow
                  key={`${city.name}-${city.country}`}
                  selected={city.name === value}
                  label={`${city.name}, ${city.country}`}
                  onClick={() => onSelect(city.name)}
                />
              ))
            )}
          </div>

          {value && (
            <div className="border-t border-border/60 p-1">
              <button
                type="button"
                onClick={onClear}
                className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
                Clear location
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
