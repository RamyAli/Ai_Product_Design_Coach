import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { detectTextDirection } from "@/domain/localized";
import { cn } from "@/lib/utils";

/**
 * Renders user or AI Markdown safely: raw HTML is not rendered, links open in a new tab
 * without referrer, and text direction follows the content rather than the UI language.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  const dir = detectTextDirection(children);
  return (
    <div className={cn("prose-coach text-sm", className)} dir={dir === "auto" ? undefined : dir}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children: c }) => {
            const safe = href && /^(https?:|mailto:|#)/i.test(href) ? href : undefined;
            return (
              <a href={safe} target="_blank" rel="noopener noreferrer nofollow">
                {c}
              </a>
            );
          },
          img: ({ alt }) => <span className="text-subtle">[{alt || "image"}]</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Plain user text with preserved line breaks and automatic direction. */
export function UserText({ text, className }: { text: string; className?: string }) {
  const dir = detectTextDirection(text);
  return (
    <p className={cn("whitespace-pre-wrap break-words", className)} dir={dir === "auto" ? undefined : dir}>
      {text}
    </p>
  );
}
