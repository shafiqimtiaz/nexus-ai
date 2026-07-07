import { Fragment, type ReactNode } from "react";

// Minimal markdown renderer for assistant chat messages. We can't add a
// markdown dependency, so this covers the formats Gemini actually emits:
// headings, bold/italic, inline code, fenced code blocks, links, blockquotes,
// and ordered/unordered lists. Anything else falls through as plain text.

// Inline: **bold**, *italic* / _italic_, `code`, [text](url). Split on the
// first matching token, recurse on the remainder so nesting stays cheap.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_|`([^`]+?)`|\[([^\]]+)\]\(([^)]+)\))/;
  let rest = text;
  let i = 0;

  while (rest.length > 0) {
    const match = pattern.exec(rest);
    if (!match) {
      nodes.push(<Fragment key={`${keyPrefix}-t${i}`}>{rest}</Fragment>);
      break;
    }
    if (match.index > 0) {
      nodes.push(<Fragment key={`${keyPrefix}-t${i}`}>{rest.slice(0, match.index)}</Fragment>);
      i += 1;
    }

    const key = `${keyPrefix}-m${i}`;
    if (match[2] !== undefined || match[3] !== undefined) {
      nodes.push(<strong key={key}>{match[2] ?? match[3]}</strong>);
    } else if (match[4] !== undefined || match[5] !== undefined) {
      nodes.push(<em key={key}>{match[4] ?? match[5]}</em>);
    } else if (match[6] !== undefined) {
      nodes.push(
        <code key={key} className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]">
          {match[6]}
        </code>
      );
    } else if (match[7] !== undefined) {
      nodes.push(
        <a
          key={key}
          href={match[8]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          {match[7]}
        </a>
      );
    }

    rest = rest.slice(match.index + match[0].length);
    i += 1;
  }

  return nodes;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-md bg-foreground/10 p-3 font-mono text-xs"
        >
          <code>{code.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // Heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push(
        <p key={key++} className={level <= 2 ? "font-semibold" : "font-medium"}>
          {renderInline(heading[2], `h${key}`)}
        </p>
      );
      i += 1;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-border pl-3 text-muted-foreground">
          {renderInline(quote.join(" "), `q${key}`)}
        </blockquote>
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-1 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ul${key}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="list-decimal space-y-1 pl-5">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `ol${key}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Blank line → skip (paragraph separator)
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    // Paragraph: gather consecutive non-blank, non-special lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^>\s?/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} className="break-words">
        {renderInline(para.join("\n"), `p${key}`)}
      </p>
    );
  }

  return <div className="space-y-2">{blocks}</div>;
}
