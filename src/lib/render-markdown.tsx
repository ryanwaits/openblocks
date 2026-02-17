import React from "react";

/** Inline formatting: **bold** */
function inlineFormat(text: string): React.ReactNode[] {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold">{part}</strong> : part
  );
}

/** Parse a markdown string into React elements (bold, lists, paragraphs) */
export function renderMarkdown(text: string): React.ReactNode[] {
  const blocks = text.split(/\n\n+/);

  return blocks.map((block, i) => {
    const lines = block.split("\n").filter((l) => l.length > 0);

    // Heading (## or ###)
    const headingMatch = block.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const cls =
        level === 1
          ? "font-bold text-[14px]"
          : level === 2
            ? "font-bold text-[13px]"
            : "font-semibold text-[13px]";
      return (
        <p key={i} className={cls}>
          {inlineFormat(headingMatch[2])}
        </p>
      );
    }

    // Bullet list (- or *)
    if (lines.every((l) => /^[-*]\s/.test(l.trim()))) {
      return (
        <ul key={i} className="list-disc space-y-0.5 pl-4">
          {lines.map((l, j) => (
            <li key={j}>{inlineFormat(l.replace(/^[-*]\s/, ""))}</li>
          ))}
        </ul>
      );
    }

    // Numbered list (1. 2. etc)
    if (lines.every((l) => /^\d+[.)]\s/.test(l.trim()))) {
      return (
        <ol key={i} className="list-decimal space-y-0.5 pl-4">
          {lines.map((l, j) => (
            <li key={j}>{inlineFormat(l.replace(/^\d+[.)]\s/, ""))}</li>
          ))}
        </ol>
      );
    }

    // Plain paragraph
    return <p key={i}>{inlineFormat(block)}</p>;
  });
}
