"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpDown } from "lucide-react";

import {
  DropdownPanel,
  FilterTrigger,
  OptionRow,
  handleDropdownArrowKeys,
} from "@/components/jobs/jobs-filter-bar";
import { useLoadingBar } from "@/components/loading";
import { SORT_OPTIONS } from "@/features/jobs/filter-options";
import { jobsUrl, type JobFilters, type SortId } from "@/features/jobs/filters";

type JobsSortButtonProps = {
  filters: JobFilters;
};

/**
 * Compact "Sort" control: a button showing the active sort that opens a
 * popover of options. Selecting applies instantly via URL navigation.
 */
export function JobsSortButton({ filters }: JobsSortButtonProps) {
  const router = useRouter();
  const { startNavigation } = useLoadingBar();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeLabel =
    SORT_OPTIONS.find((option) => option.id === filters.sort)?.label ??
    "Newest first";

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const select = (sort: SortId) => {
    setIsOpen(false);
    if (sort === filters.sort) return;
    startNavigation();
    router.push(jobsUrl({ ...filters, sort, page: 1 }));
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      onKeyDown={isOpen ? handleDropdownArrowKeys : undefined}
    >
      <FilterTrigger
        active={filters.sort !== "newest"}
        isOpen={isOpen}
        label={activeLabel}
        icon={<ArrowUpDown className="size-3.5" />}
        onClick={() => setIsOpen((open) => !open)}
      />
      {isOpen && (
        <DropdownPanel align="right">
          {SORT_OPTIONS.map((option) => (
            <OptionRow
              key={option.id}
              selected={option.id === filters.sort}
              label={option.label}
              onClick={() => select(option.id)}
            />
          ))}
        </DropdownPanel>
      )}
    </div>
  );
}
