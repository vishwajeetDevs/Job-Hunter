/**
 * Salary extraction from unstructured job description text.
 *
 * Handles all common Indian/international pay formats:
 *   - ₹25,000 – ₹30,000 per month
 *   - Pay: ₹25000-30000/month
 *   - 5-10 LPA / 5–10 lakh per annum
 *   - CTC: 8 LPA
 *   - $80,000–$100,000/year
 *   - 500–800 USD/month
 *   - Stipend: ₹15,000/month
 *   - ₹500–₹700 per hour
 *
 * Canonical output: annual figures in the detected currency.
 * Returns null when no confident salary signal is found.
 */

export type ExtractedSalary = {
  min: number | null;
  max: number | null;
  currency: string;
  /** Human-readable label derived from the raw match; passed through to the card. */
  label: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  "₹": "₹",
  rs: "₹",
  "rs.": "₹",
  inr: "₹",
  $: "$",
  usd: "$",
  "£": "£",
  gbp: "£",
  "€": "€",
  eur: "€",
  aed: "AED",
  sgd: "SGD",
};

function parseMoney(raw: string): number {
  // Strip thousands separators, normalize decimal point.
  return parseFloat(raw.replace(/,/g, "").trim()) || 0;
}

function annualize(value: number, period: string): number {
  const p = period.toLowerCase();
  if (/hour|hr/.test(p)) return value * 8 * 250;
  if (/day|daily/.test(p)) return value * 250;
  if (/week/.test(p)) return value * 52;
  if (/month|mon\b|pm\b|\/m\b|p\.m\./.test(p)) return value * 12;
  // Already annual.
  return value;
}

/** True when the number "looks like" a monthly salary (heuristic). */
function looksMonthly(value: number): boolean {
  // Indian monthly salaries typically 5 000 – 999 999.
  // Values > 5 000 000 are almost certainly annual.
  return value >= 3000 && value <= 999999;
}

/** Produce a compact display label from currency + raw matched text. */
function makeLabel(currency: string, raw: string): string {
  // Keep original formatting (commas, dashes) but trim surrounding noise.
  return `${currency} ${raw.trim()}`.replace(/\s+/g, " ").trim();
}

function trim1dp(n: number): string {
  const s = String(Math.round(n * 10) / 10);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

function annualLabel(currency: string, min: number | null, max: number | null): string {
  const isINR = currency === "₹";
  const fmt = (v: number) => {
    if (isINR) {
      if (v >= 10000000) return `${trim1dp(v / 10000000)}Cr`;
      if (v >= 100000) return `${trim1dp(v / 100000)}L`;
      return v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);
    }
    return v >= 1000 ? `${Math.round(v / 1000)}K` : String(v);
  };
  if (min && max) return `${currency} ${fmt(min)}–${fmt(max)} p.a.`;
  const single = min ?? max;
  return single ? `${currency} ${fmt(single)}+ p.a.` : "";
}

// ---------------------------------------------------------------------------
// Pattern set (ordered: more specific first)
// ---------------------------------------------------------------------------

type SalaryMatch = {
  min: number;
  max: number | null;
  currency: string;
  annualized: boolean;
  rawLabel: string;
};

function tryCandidates(text: string): SalaryMatch | null {
  const t = text;

  // ---- 1. LPA / Lakh per annum patterns (most unambiguous for India) ----

  // "5-10 LPA", "5 to 10 LPA", "5–10 lpa", "upto 12 lpa", "5.5 LPA"
  const LPA_RANGE = /(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(?:lpa|l\.p\.a\.?|lakh[s]?\s+(?:per\s+annum|p\.a\.|pa)|lakhs?\s+\/\s*(?:year|annum))/i;
  const LPA_SINGLE = /(?:upto\s+|up\s+to\s+|up-to\s+)?(\d+(?:\.\d+)?)\s*(?:lpa|l\.p\.a\.?|lakh[s]?\s+(?:per\s+annum|p\.a\.|pa)|lakhs?\s+\/\s*(?:year|annum))/i;

  let m: RegExpMatchArray | null;

  m = t.match(LPA_RANGE);
  if (m) {
    const min = parseMoney(m[1]) * 100000;
    const max = parseMoney(m[2]) * 100000;
    return { min, max, currency: "₹", annualized: true, rawLabel: m[0] };
  }

  m = t.match(LPA_SINGLE);
  if (m) {
    const val = parseMoney(m[1]) * 100000;
    return { min: val, max: null, currency: "₹", annualized: true, rawLabel: m[0] };
  }

  // ---- 2. Currency symbol + amount + optional period ----

  // Captures: ₹25,000 – ₹30,000 per month / $80,000-$100,000/year
  // Also: 25,000 – 30,000 INR/month  (symbol after amount)
  const CURRENCY_BEFORE_RANGE =
    /(₹|\$|£|€|rs\.?\s*|inr\s*|usd\s*|gbp\s*|eur\s*|aed\s*|sgd\s*)\s*([\d,]+(?:\.\d+)?)\s*(?:-|–|to)\s*(₹|\$|£|€|rs\.?\s*|inr\s*|usd\s*|gbp\s*|eur\s*|aed\s*|sgd\s*)?\s*([\d,]+(?:\.\d+)?)(?:\s*(?:\/|\bper\b)\s*(\w+))?/i;

  m = t.match(CURRENCY_BEFORE_RANGE);
  if (m) {
    const rawCurrency = (m[1] || m[3] || "₹").toLowerCase().trim();
    const currency = CURRENCY_SYMBOLS[rawCurrency] ?? rawCurrency.toUpperCase();
    const rawMin = parseMoney(m[2]);
    const rawMax = parseMoney(m[4]);
    const period = m[5] ?? "";
    const min = annualize(rawMin, period);
    const max = annualize(rawMax, period);
    const annualized = !!period;
    return { min, max, currency, annualized, rawLabel: m[0] };
  }

  const CURRENCY_BEFORE_SINGLE =
    /(₹|\$|£|€|rs\.?\s*|inr\s*|usd\s*)?\s*([\d,]+(?:\.\d+)?)\s*(?:₹|\$|£|€|rs\.?|inr|usd)?\s*(?:\/|\bper\b)\s*(\w+)/i;

  m = t.match(CURRENCY_BEFORE_SINGLE);
  if (m) {
    const rawCurrency = ((m[1] ?? "").toLowerCase().trim()) || "₹";
    const currency = CURRENCY_SYMBOLS[rawCurrency] ?? rawCurrency.toUpperCase();
    const rawVal = parseMoney(m[2]);
    const period = m[3] ?? "";
    const val = annualize(rawVal, period);
    return { min: val, max: null, currency, annualized: !!period, rawLabel: m[0] };
  }

  // ---- 3. Bare INR amounts without explicit currency (context anchor) ----
  // Require a context keyword (pay, salary, ctc, stipend, package, compensation)
  // within the same short window so we don't pick up experience years etc.

  const CONTEXT_ANCHOR =
    /(?:pay|salary|ctc|cost\s+to\s+company|package|compensation|remuneration|stipend|fixed|annual|fixed\s+pay|take[\s-]home|in-hand)\s*[:\-–]?\s*([\d,]+(?:\.\d+)?)\s*(?:-|–|to)?\s*([\d,]+(?:\.\d+)?)?\s*(?:\/|\bper\b)?\s*(\w+)?/i;

  m = t.match(CONTEXT_ANCHOR);
  if (m) {
    const rawMin = parseMoney(m[1]);
    const rawMax = m[2] ? parseMoney(m[2]) : null;
    const period = m[3] ?? "";
    if (rawMin > 0 && rawMin < 100000000) {
      // Decide whether period is annual or monthly.
      const isAnnualPeriod = /year|annum|annual|pa\b|lpa/.test(period.toLowerCase());
      const isMonthlyPeriod = /month|mon\b|pm\b/.test(period.toLowerCase());
      const min = isAnnualPeriod
        ? rawMin
        : isMonthlyPeriod
          ? rawMin * 12
          : looksMonthly(rawMin)
            ? rawMin * 12
            : rawMin;
      const max = rawMax
        ? isAnnualPeriod
          ? rawMax
          : isMonthlyPeriod
            ? rawMax * 12
            : looksMonthly(rawMax)
              ? rawMax * 12
              : rawMax
        : null;
      return { min, max, currency: "₹", annualized: true, rawLabel: m[0] };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Searches the first 3 000 characters of a job description for a salary
 * signal, normalizes it to annual figures, and returns a structured result.
 *
 * Returns null when no confident salary is found so the caller can decide
 * whether to show "Package not listed".
 */
export function extractSalaryFromDescription(
  description: string | null | undefined
): ExtractedSalary | null {
  if (!description) return null;

  // Search only the top of the description where salary is typically stated.
  const searchText = description.slice(0, 3000);

  // Split into lines and scan each line individually first — line-level
  // matches are more reliable (avoids cross-line false positives).
  const lines = searchText.split(/\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const hit = tryCandidates(trimmed);
    if (hit && hit.min > 0) {
      const label = hit.annualized
        ? annualLabel(hit.currency, hit.min, hit.max)
        : makeLabel(hit.currency, hit.rawLabel);
      return {
        min: hit.min,
        max: hit.max,
        currency: hit.currency,
        label,
      };
    }
  }

  // Fallback: scan the full slice (catches spans split across lines).
  const hit = tryCandidates(searchText.replace(/\n/g, " "));
  if (hit && hit.min > 0) {
    const label = hit.annualized
      ? annualLabel(hit.currency, hit.min, hit.max)
      : makeLabel(hit.currency, hit.rawLabel);
    return {
      min: hit.min,
      max: hit.max,
      currency: hit.currency,
      label,
    };
  }

  return null;
}
