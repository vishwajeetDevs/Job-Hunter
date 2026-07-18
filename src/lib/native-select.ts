/**
 * Shared Tailwind classes for native `<select>` elements.
 * Pair with global `color-scheme: dark` (globals.css) so the OS
 * dropdown panel also renders in dark mode on Windows.
 */
export const nativeSelectClassName =
  "border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border px-2.5 py-1 text-sm outline-none focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-popover dark:text-popover-foreground";
