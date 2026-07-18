import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from "pdf-lib";

import type {
  OptimizedResumeContent,
  OptimizedResumeEntry,
} from "@/features/studio/types";
import type { ResumeExporter } from "@/services/studio/exporters/exporter.interface";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.44, 0.48);
const RULE = rgb(0.8, 0.82, 0.85);

/**
 * The standard PDF fonts only support WinAnsi (Latin-1) encoding, but
 * AI output routinely contains smart quotes, unicode dashes, etc.
 * Map the common ones to ASCII equivalents and strip the rest so
 * rendering never throws.
 */
const CHAR_REPLACEMENTS: Record<string, string> = {
  "\u2010": "-", // hyphen
  "\u2011": "-", // non-breaking hyphen
  "\u2012": "-",
  "\u2013": "-", // en dash
  "\u2014": "-", // em dash
  "\u2015": "-",
  "\u2212": "-", // minus sign
  "\u2018": "'",
  "\u2019": "'",
  "\u201A": "'",
  "\u201B": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u201E": '"',
  "\u2026": "...",
  "\u00A0": " ", // non-breaking space
  "\u2009": " ",
  "\u202F": " ",
  "\u2192": "->",
  "\u2190": "<-",
  "\u20B9": "Rs ", // Indian rupee sign
  "\u2713": "-",
  "\u2714": "-",
};

function toWinAnsiSafe(text: string): string {
  let result = "";

  for (const char of text) {
    const replacement = CHAR_REPLACEMENTS[char];
    if (replacement !== undefined) {
      result += replacement;
      continue;
    }
    result += char;
  }

  // Decompose accents (é → e + ́), drop combining marks, then strip
  // anything still outside Latin-1 that WinAnsi cannot encode.
  return result
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\xFF\u2022]/g, "");
}

function wrapLines(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

/** Simple cursor-based PDF layout with automatic page breaks. */
class PdfWriter {
  page: PDFPage;
  y: number;

  constructor(
    private readonly doc: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private ensureSpace(height: number) {
    if (this.y - height < MARGIN) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      this.y = PAGE_HEIGHT - MARGIN;
    }
  }

  text(
    value: string,
    options: {
      size: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      lineGap?: number;
    }
  ) {
    const font = options.bold ? this.bold : this.regular;
    const indent = options.indent ?? 0;
    const lineHeight = options.size + (options.lineGap ?? 2.5);
    const lines = wrapLines(
      toWinAnsiSafe(value),
      font,
      options.size,
      CONTENT_WIDTH - indent
    );

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: MARGIN + indent,
        y: this.y - options.size,
        size: options.size,
        font,
        color: options.color ?? INK,
      });
      this.y -= lineHeight;
    }
  }

  gap(height: number) {
    this.y -= height;
  }

  rule() {
    this.ensureSpace(8);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: RULE,
    });
    this.y -= 8;
  }

  sectionTitle(title: string) {
    this.gap(8);
    this.text(title.toUpperCase(), { size: 10.5, bold: true });
    this.rule();
  }

  entry(item: OptimizedResumeEntry) {
    const headingLine = [item.heading, item.subheading]
      .filter(Boolean)
      .join(" — ");

    if (headingLine) {
      this.text(headingLine, { size: 11, bold: true });
    }
    if (item.period) {
      this.text(item.period, { size: 9, color: MUTED });
    }
    for (const bullet of item.bullets) {
      this.text(`•  ${bullet}`, { size: 10, indent: 6 });
    }
    this.gap(6);
  }
}

async function renderPdf(
  content: OptimizedResumeContent,
  title: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);

  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const writer = new PdfWriter(doc, regular, bold);

  if (content.name) {
    writer.text(content.name, { size: 19, bold: true });
  }
  if (content.headline) {
    writer.text(content.headline, { size: 11, color: MUTED });
  }
  if (content.contact) {
    writer.text(content.contact, { size: 9, color: MUTED });
  }

  if (content.summary) {
    writer.sectionTitle("Summary");
    writer.text(content.summary, { size: 10 });
  }

  if (content.skills.length > 0) {
    writer.sectionTitle("Skills");
    writer.text(content.skills.join("  •  "), { size: 10 });
  }

  const sections: Array<[string, OptimizedResumeEntry[]]> = [
    ["Experience", content.experience],
    ["Projects", content.projects],
    ["Education", content.education],
  ];

  for (const [sectionTitle, entries] of sections) {
    if (entries.length === 0) continue;
    writer.sectionTitle(sectionTitle);
    for (const entry of entries) {
      writer.entry(entry);
    }
  }

  return doc.save();
}

export const pdfResumeExporter: ResumeExporter = {
  format: "pdf",
  contentType: "application/pdf",
  extension: ".pdf",
  render: renderPdf,
};
