import React from "react";

// The assistant is told to answer in short sentences or bullet points, and Gemini
// marks bold text with **. This renders just that subset as React elements (never
// as HTML), so nothing in an answer can inject markup.

const LIST_ITEM = /^\s*(?:[-*•]|(\d+)[.)])\s+(.*)$/;

// While an answer is still "typing", a **bold** may be half written; close it
const balanceBold = (text) => ((text.match(/\*\*/g) || []).length % 2 ? `${text}**` : text);

function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={index} className="font-semibold text-fg">{part.slice(2, -2)}</strong>
    ) : (
      <React.Fragment key={index}>{part}</React.Fragment>
    )
  );
}

// Plain text for copying and reading aloud
export const plainText = (text) =>
  text
    .split("\n")
    .map((line) => line.replace(LIST_ITEM, (match, number, rest) => (number ? `${number}. ${rest}` : `• ${rest}`)))
    .join("\n")
    .replace(/\*\*/g, "")
    .trim();

function Markdown({ text }) {
  const blocks = [];

  balanceBold(text)
    .split("\n")
    .forEach((line) => {
      const item = line.match(LIST_ITEM);
      const last = blocks[blocks.length - 1];

      if (item) {
        const ordered = Boolean(item[1]);
        if (last?.type === "list" && last.ordered === ordered) {
          last.items.push(item[2]);
        } else {
          blocks.push({ type: "list", ordered, items: [item[2]] });
        }
      } else if (!line.trim()) {
        blocks.push({ type: "break" });
      } else if (last?.type === "paragraph") {
        last.lines.push(line);
      } else {
        blocks.push({ type: "paragraph", lines: [line] });
      }
    });

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List key={index} className={block.ordered ? "list-decimal space-y-1.5 pl-5 marker:text-primary" : "space-y-1.5"}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className={block.ordered ? "pl-1" : "flex gap-2.5"}>
                  {!block.ordered && <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-primary" />}
                  <span><Inline text={item} /></span>
                </li>
              ))}
            </List>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={index}>
              {block.lines.map((line, lineIndex) => (
                <React.Fragment key={lineIndex}>
                  {lineIndex > 0 && <br />}
                  <Inline text={line} />
                </React.Fragment>
              ))}
            </p>
          );
        }

        return null;
      })}
    </div>
  );
}

export default Markdown;
