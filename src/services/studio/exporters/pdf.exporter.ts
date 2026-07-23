/**
 * PDF Resume Exporter
 *
 * Renders the AI-generated resume content as a US Letter PDF that exactly
 * mirrors the reference LaTeX-style template:
 *   • Centered header — large small-caps name, headline, contact, thick rule
 *   • Section titles — bold, full-width bottom rule
 *   • Skills — "Category: item1, item2" with inline bold category label
 *   • Entries — Role | Company (left) + Date (right) on the same line;
 *               italic subheading on the next line; indented bullet points
 */

import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

import type {
  OptimizedResumeContent,
  OptimizedResumeEntry,
} from "@/features/studio/types";
import type { ResumeExporter } from "@/services/studio/exporters/exporter.interface";

// ---------------------------------------------------------------------------
// Page constants
// ---------------------------------------------------------------------------

const PAGE_W = 612;  // US Letter width  (8.5 in × 72 pt/in)
const PAGE_H = 792;  // US Letter height (11  in × 72 pt/in)
const MARGIN  = 52;
const CW      = PAGE_W - MARGIN * 2; // usable content width

// Colors
const INK    = rgb(0.07, 0.07, 0.08);  // near-black body
const RULE_C = rgb(0.22, 0.22, 0.24);  // dark rule under sections & header

// ---------------------------------------------------------------------------
// Unicode → WinAnsi sanitizer
// ---------------------------------------------------------------------------

const CHAR_MAP: Record<string, string> = {
  "\u2010": "-", "\u2011": "-", "\u2012": "-",
  "\u2013": "-", "\u2014": "-", "\u2015": "-", "\u2212": "-",
  "\u2018": "'", "\u2019": "'", "\u201A": "'", "\u201B": "'",
  "\u201C": '"', "\u201D": '"', "\u201E": '"',
  "\u2026": "...",
  "\u00A0": " ", "\u2009": " ", "\u202F": " ",
  "\u2192": "->", "\u2190": "<-",
  "\u20B9": "Rs ",
  "\u2713": "-", "\u2714": "-",
  "|": "|",
};

function safe(text: string): string {
  let out = "";
  for (const ch of text) {
    out += CHAR_MAP[ch] ?? ch;
  }
  return out
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\xFF\u2022]/g, "");
}

// ---------------------------------------------------------------------------
// Word-wrap utility
// ---------------------------------------------------------------------------

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// ---------------------------------------------------------------------------
// PdfWriter — cursor-based layout engine
// ---------------------------------------------------------------------------

class PdfWriter {
  page!: PDFPage;
  y = 0;

  constructor(
    private readonly doc: PDFDocument,
    private readonly reg: PDFFont,
    private readonly bld: PDFFont,
    private readonly ita: PDFFont
  ) {
    this.newPage();
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  private need(h: number) {
    if (this.y - h < MARGIN) this.newPage();
  }

  // ── Primitives ────────────────────────────────────────────────────────────

  gap(h: number) {
    this.y -= h;
  }

  /** Horizontal rule spanning the full content width. */
  rule(thickness = 0.75) {
    this.need(6);
    this.page.drawLine({
      start: { x: MARGIN,      y: this.y },
      end:   { x: PAGE_W - MARGIN, y: this.y },
      thickness,
      color: RULE_C,
    });
    this.y -= 6;
  }

  /**
   * Draws a single line of text at the current cursor position.
   * Does NOT advance y — callers must advance after calling this.
   */
  private drawAt(
    text: string,
    x: number,
    font: PDFFont,
    size: number,
    color = INK
  ) {
    this.page.drawText(text, { x, y: this.y - size, size, font, color });
  }

  // ── Centered text (header section) ───────────────────────────────────────

  /** Draws centered text and advances y. */
  centered(text: string, size: number, bold = false, lineGap = 2) {
    const font = bold ? this.bld : this.reg;
    const lh = size + lineGap;
    const lines = wrap(safe(text), font, size, CW);
    for (const line of lines) {
      this.need(lh);
      const w = font.widthOfTextAtSize(line, size);
      this.drawAt(line, (PAGE_W - w) / 2, font, size);
      this.y -= lh;
    }
  }

  // ── Left-aligned wrapped text ─────────────────────────────────────────────

  /** Left-aligned, wrapping text block. Advances y. */
  text(
    text: string,
    size: number,
    opts: { bold?: boolean; italic?: boolean; indent?: number; lineGap?: number } = {}
  ) {
    const font  = opts.bold ? this.bld : opts.italic ? this.ita : this.reg;
    const lh    = size + (opts.lineGap ?? 2.5);
    const x0    = MARGIN + (opts.indent ?? 0);
    const lines = wrap(safe(text), font, size, CW - (opts.indent ?? 0));
    for (const line of lines) {
      this.need(lh);
      this.drawAt(line, x0, font, size);
      this.y -= lh;
    }
  }

  // ── Two-column row: left text + right text on the same baseline ───────────

  /**
   * Renders `left` text left-aligned and `right` text right-aligned on the
   * same baseline.  If `left` is so long that it would overlap `right`, the
   * remaining left words wrap onto subsequent lines (right only appears once).
   */
  twoCol(
    left: string,
    right: string | undefined,
    size: number,
    opts: { bold?: boolean; italic?: boolean; lineGap?: number } = {}
  ) {
    const font  = opts.bold ? this.bld : opts.italic ? this.ita : this.reg;
    const lh    = size + (opts.lineGap ?? 2.5);
    const leftSafe  = safe(left);
    const rightSafe = right ? safe(right) : "";
    const rightW    = right ? font.widthOfTextAtSize(rightSafe, size) : 0;
    const rightX    = PAGE_W - MARGIN - rightW;
    const maxLeft   = rightW > 0 ? CW - rightW - 6 : CW;

    const lines = wrap(leftSafe, font, size, maxLeft);

    for (let i = 0; i < lines.length; i++) {
      this.need(lh);
      this.drawAt(lines[i], MARGIN, font, size);
      if (i === 0 && rightSafe) {
        this.drawAt(rightSafe, rightX, font, size);
      }
      this.y -= lh;
    }
  }

  // ── Inline mixed-weight line (bold label + regular text) ─────────────────

  /**
   * Renders `label` in bold immediately followed by `rest` in regular weight,
   * on the same line.  `rest` wraps at the content width if needed.
   */
  boldThenRegular(label: string, rest: string, size: number, indent = 0) {
    const lh        = size + 2.5;
    const labelSafe = safe(label);
    const restSafe  = safe(rest);
    const labelW    = this.bld.widthOfTextAtSize(labelSafe, size);
    const x0        = MARGIN + indent;
    const restMaxW  = CW - indent - labelW;

    const restLines = wrap(restSafe, this.reg, size, restMaxW);

    this.need(lh);
    this.drawAt(labelSafe, x0, this.bld, size);
    this.drawAt(restLines[0] ?? "", x0 + labelW, this.reg, size);
    this.y -= lh;

    for (let i = 1; i < restLines.length; i++) {
      this.need(lh);
      this.drawAt(restLines[i], x0 + labelW, this.reg, size);
      this.y -= lh;
    }
  }

  // ── Bullet point ─────────────────────────────────────────────────────────

  bullet(text: string, size = 10) {
    const lh      = size + 2.5;
    const indent  = 14;
    const bullet  = "\u2022  "; // •
    const bw      = this.reg.widthOfTextAtSize(bullet, size);
    const lines   = wrap(safe(text), this.reg, size, CW - indent - bw);

    for (let i = 0; i < lines.length; i++) {
      this.need(lh);
      if (i === 0) {
        this.drawAt(bullet, MARGIN + indent, this.reg, size);
        this.drawAt(lines[i], MARGIN + indent + bw, this.reg, size);
      } else {
        this.drawAt(lines[i], MARGIN + indent + bw, this.reg, size);
      }
      this.y -= lh;
    }
  }

  // ── Section title ─────────────────────────────────────────────────────────

  section(title: string) {
    this.gap(7);
    this.need(20);
    const size = 11.5;
    const lh   = size + 2;
    this.drawAt(safe(title), MARGIN, this.bld, size);
    this.y -= lh;
    // immediate bottom rule
    this.page.drawLine({
      start: { x: MARGIN,          y: this.y },
      end:   { x: PAGE_W - MARGIN, y: this.y },
      thickness: 0.7,
      color: RULE_C,
    });
    this.y -= 5;
  }

  // ── Resume entry (experience / education / project / etc.) ───────────────

  entry(item: OptimizedResumeEntry, combinedHeading = false) {
    const headingLine = combinedHeading && item.subheading
      ? `${item.heading} | ${item.subheading}`
      : item.heading;

    // Line 1: heading left, period right
    this.twoCol(headingLine, item.period, 10.5, { bold: true });

    // Line 2: subheading italic (only when heading and subheading are separate)
    if (!combinedHeading && item.subheading) {
      this.text(item.subheading, 9.5, { italic: true });
    }

    // Bullets
    for (const b of item.bullets) {
      this.bullet(b, 10);
    }
    this.gap(5);
  }
}

// ---------------------------------------------------------------------------
// Skill parser
// ---------------------------------------------------------------------------

function parseSkillGroup(
  skill: string
): { category: string; items: string } | null {
  const m = skill.match(/^([^:]+):\s*(.+)$/);
  if (!m) return null;
  return { category: m[1].trim() + ":", items: m[2].trim() };
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

async function renderPdf(
  content: OptimizedResumeContent,
  title: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);

  const reg = await doc.embedFont(StandardFonts.TimesRoman);
  const bld = await doc.embedFont(StandardFonts.TimesRomanBold);
  const ita = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const w   = new PdfWriter(doc, reg, bld, ita);

  // ── Header ────────────────────────────────────────────────────────────────
  if (content.name) {
    w.centered(content.name.toUpperCase(), 22, true, 3);
  }
  if (content.headline) {
    w.centered(content.headline, 11, false, 2);
  }
  if (content.contact) {
    w.centered(content.contact, 9.5, false, 2);
  }
  w.gap(3);
  w.rule(1); // thick rule after contact

  // ── Summary ───────────────────────────────────────────────────────────────
  if (content.summary?.trim()) {
    w.section("Summary");
    w.text(content.summary, 10, { lineGap: 3 });
  }

  // ── Technical Skills ──────────────────────────────────────────────────────
  if (content.skills.length > 0) {
    w.section("Technical Skills");
    const groups = content.skills.map(parseSkillGroup);
    const allGrouped = groups.every(Boolean);

    if (allGrouped) {
      for (const g of groups) {
        if (g) w.boldThenRegular(g.category + " ", g.items, 10, 4);
      }
    } else {
      w.text(content.skills.join("  •  "), 10, { indent: 4 });
    }
  }

  // ── Professional Experience ───────────────────────────────────────────────
  if (content.experience.length > 0) {
    w.section("Professional Experience");
    for (const e of content.experience) w.entry(e, true);
  }

  // ── Projects ─────────────────────────────────────────────────────────────
  if (content.projects.length > 0) {
    w.section("Projects");
    for (const e of content.projects) w.entry(e, true);
  }

  // ── Education ────────────────────────────────────────────────────────────
  if (content.education.length > 0) {
    w.section("Education");
    for (const e of content.education) w.entry(e, false);
  }

  // ── Certifications ────────────────────────────────────────────────────────
  if ((content.certifications ?? []).length > 0) {
    w.section("Certifications");
    for (const e of content.certifications) w.entry(e, false);
  }

  // ── Achievements ─────────────────────────────────────────────────────────
  if ((content.achievements ?? []).length > 0) {
    w.section("Achievements");
    for (const e of content.achievements) w.entry(e, false);
  }

  return doc.save();
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const pdfResumeExporter: ResumeExporter = {
  format: "pdf",
  contentType: "application/pdf",
  extension: ".pdf",
  render: renderPdf,
};
