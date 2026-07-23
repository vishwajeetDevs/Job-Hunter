import type { ReactNode } from "react";

/**
 * Renders the markdown subset produced by `htmlToMarkdown` at ingestion:
 * #–#### headings, bullet / numbered lists, **bold**, *italic*, `---`
 * rules, and paragraphs. Descriptions ingested before the markdown
 * migration are plain text, which renders unchanged as paragraphs.
 *
 * A hand-rolled parser (instead of a markdown library) keeps the bundle
 * small and avoids ever injecting HTML from external job boards.
 */

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "rule" }
  | { type: "paragraph"; lines: string[] };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split("\n");

  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (/^-{3,}$/.test(line)) {
      blocks.push({ type: "rule" });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    // Some boards wrap whole paragraphs in heading tags; render anything
    // too long to be a real section title as a normal paragraph instead.
    if (heading && heading[2].length <= 120) {
      blocks.push({
        type: "heading",
        level: heading[1].length,
        text: heading[2].trim(),
      });
      index += 1;
      continue;
    }
    if (heading) {
      blocks.push({ type: "paragraph", lines: [heading[2].trim()] });
      index += 1;
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    const numbered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].trim();
        const match = ordered
          ? item.match(/^\d+[.)]\s+(.+)$/)
          : item.match(/^[-*]\s+(.+)$/);
        if (!match) break;
        items.push(match[1].trim());
        index += 1;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    // Paragraph: consecutive plain lines until a blank line or block marker.
    const paragraph: string[] = [];
    while (index < lines.length) {
      const text = lines[index].trim();
      if (
        !text ||
        /^(#{1,4})\s/.test(text) ||
        /^[-*]\s/.test(text) ||
        /^\d+[.)]\s/.test(text) ||
        /^-{3,}$/.test(text)
      ) {
        break;
      }
      paragraph.push(text);
      index += 1;
    }
    blocks.push({ type: "paragraph", lines: paragraph });
  }

  return blocks;
}

/** Renders **bold** and *italic* spans within a line of text. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  // Split on bold first, then italic inside the remaining plain chunks.
  return text.split(/(\*\*[^*]+\*\*)/g).flatMap((chunk, boldIndex) => {
    const bold = chunk.match(/^\*\*([^*]+)\*\*$/);
    if (bold) {
      return (
        <strong key={`${keyPrefix}-b${boldIndex}`} className="font-semibold text-foreground">
          {bold[1]}
        </strong>
      );
    }

    return chunk.split(/(\*[^*\s][^*]*\*)/g).map((part, italicIndex) => {
      const italic = part.match(/^\*([^*]+)\*$/);
      if (italic) {
        return (
          <em key={`${keyPrefix}-b${boldIndex}-i${italicIndex}`}>{italic[1]}</em>
        );
      }
      // Unmatched markers (malformed source HTML) render as plain text
      // rather than literal asterisks.
      return part.replace(/\*\*/g, "");
    });
  });
}

const HEADING_CLASSES: Record<number, string> = {
  1: "mt-6 text-lg font-semibold text-foreground first:mt-0",
  2: "mt-6 text-base font-semibold text-foreground first:mt-0",
  3: "mt-5 text-[0.95rem] font-semibold text-foreground first:mt-0",
  4: "mt-4 text-sm font-semibold text-foreground first:mt-0",
};

export function JobDescriptionContent({ markdown }: { markdown: string }) {
  const blocks = parseBlocks(markdown);

  return (
    <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return (
              <p key={index} className={HEADING_CLASSES[block.level]}>
                {renderInline(block.text, `h${index}`)}
              </p>
            );
          case "rule":
            return <hr key={index} className="my-4 border-border/60" />;
          case "list": {
            const ListTag = block.ordered ? "ol" : "ul";
            return (
              <ListTag
                key={index}
                className={
                  block.ordered
                    ? "ml-5 list-decimal space-y-1.5 marker:text-muted-foreground/70"
                    : "ml-5 list-disc space-y-1.5 marker:text-muted-foreground/70"
                }
              >
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    {renderInline(item, `l${index}-${itemIndex}`)}
                  </li>
                ))}
              </ListTag>
            );
          }
          case "paragraph":
            return (
              <p key={index}>
                {block.lines.map((line, lineIndex) => (
                  <span key={lineIndex}>
                    {lineIndex > 0 && <br />}
                    {renderInline(line, `p${index}-${lineIndex}`)}
                  </span>
                ))}
              </p>
            );
        }
      })}
    </div>
  );
}
