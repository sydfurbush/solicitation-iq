import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "./MermaidBlock";
import { OrgChartBlock, looksLikeOrgChart } from "./OrgChartBlock";

/**
 * If the model emitted a markdown table on a single line (rows separated by
 * "| |" instead of "|\n|"), insert newlines so remark-gfm can parse it.
 */
export function normalizeAssistantMarkdown(input: string): string {
  if (!input || !input.includes("|")) return input;
  if (!/\|\s*-{3,}\s*\|/.test(input)) return input;
  if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m.test(input)) {
    return input;
  }
  return input
    .replace(/\|[ \t]+\|/g, "|\n|")
    .replace(/\n{3,}/g, "\n\n");
}

export const ASSISTANT_PROSE_CLASS =
  "prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h1:mt-4 prose-h1:mb-2 prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-3 prose-h3:mb-1.5 prose-h4:text-sm prose-h4:mt-3 prose-h4:mb-1 prose-p:my-2 prose-p:leading-relaxed prose-ul:my-2 prose-ul:pl-5 prose-ol:my-2 prose-ol:pl-5 prose-li:my-0.5 prose-li:marker:text-muted-foreground prose-strong:text-foreground prose-strong:font-semibold prose-em:text-foreground prose-a:text-primary prose-a:underline prose-a:underline-offset-2 hover:prose-a:opacity-80 prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:italic prose-blockquote:text-muted-foreground prose-hr:my-4 prose-hr:border-border prose-code:before:content-none prose-code:after:content-none prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-mono prose-pre:bg-muted prose-pre:text-foreground prose-pre:border prose-pre:border-border prose-pre:rounded-md prose-pre:p-3 prose-pre:overflow-x-auto prose-pre:my-3 prose-pre:text-[0.85em] prose-img:rounded-md prose-img:my-3 [&_ul.contains-task-list]:list-none [&_ul.contains-task-list]:pl-0 [&_ul.contains-task-list]:my-2 [&_li.task-list-item>ul.contains-task-list]:my-1 [&_li.task-list-item>ol]:my-1 [&_li.task-list-item>ul.contains-task-list:first-child]:mt-0 [&_li.task-list-item>ul.contains-task-list:last-child]:mb-0 [&_li.task-list-item>ol:first-child]:mt-0 [&_li.task-list-item>ol:last-child]:mb-0 [&_li.task-list-item]:grid [&_li.task-list-item]:grid-cols-[auto_1fr] [&_li.task-list-item]:items-start [&_li.task-list-item]:gap-x-2 [&_li.task-list-item]:my-1 [&_li.task-list-item:first-child]:mt-0 [&_li.task-list-item:last-child]:mb-0 [&_li.task-list-item]:leading-relaxed [&_li.task-list-item]:pl-0 [&_li.task-list-item]:before:hidden [&_li.task-list-item>p]:my-0 [&_li.task-list-item>p]:col-start-2 [&_li.task-list-item>ul]:col-start-2 [&_li.task-list-item>ol]:col-start-2 [&_li.task-list-item>input[type=checkbox]]:row-start-1 [&_li.task-list-item>input[type=checkbox]]:col-start-1 [&_li.task-list-item>input[type=checkbox]]:mt-[0.3em] [&_li.task-list-item>input[type=checkbox]]:h-3.5 [&_li.task-list-item>input[type=checkbox]]:w-3.5 [&_li.task-list-item>input[type=checkbox]]:shrink-0 [&_li.task-list-item>input[type=checkbox]]:cursor-default [&_li.task-list-item>input[type=checkbox]]:accent-primary";

export function AssistantMessageBody({ text }: { text: string }) {
  return (
    <div className={ASSISTANT_PROSE_CLASS}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          pre: ({ node, children, ...props }: any) => {
            const child: any = Array.isArray(children) ? children[0] : children;
            const childClass: string = child?.props?.className ?? "";
            const childText: string = Array.isArray(child?.props?.children)
              ? child.props.children.join("")
              : String(child?.props?.children ?? "");
            if (/language-mermaid/.test(childClass)) return <>{children}</>;
            if (looksLikeOrgChart(childText)) return <>{children}</>;
            return (
              <pre
                {...props}
                className="not-prose my-3 overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-[0.8rem] leading-relaxed whitespace-pre font-mono"
              >
                {children}
              </pre>
            );
          },
          code: ({ node, className, children, ...props }: any) => {
            const codeText = String(Array.isArray(children) ? children.join("") : children ?? "");
            if (/language-mermaid/.test(className ?? "")) {
              return <MermaidBlock code={codeText.replace(/\n$/, "")} />;
            }
            const isBlock = /language-/.test(className ?? "") || codeText.includes("\n");
            if (isBlock && looksLikeOrgChart(codeText)) {
              return <OrgChartBlock code={codeText.replace(/\n$/, "")} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          input: ({ node, ...props }: any) => {
            if (props.type === "checkbox") return <input {...props} disabled readOnly />;
            return <input {...props} />;
          },
          table: ({ node, ...props }) => (
            <div className="my-3 -mx-1 overflow-x-auto rounded-md border border-border">
              <table {...props} className="w-full border-collapse text-sm table-auto" />
            </div>
          ),
          thead: ({ node, ...props }) => <thead {...props} className="bg-muted/60" />,
          tbody: ({ node, ...props }) => (
            <tbody {...props} className="[&_tr:nth-child(even)]:bg-muted/20" />
          ),
          tr: ({ node, ...props }) => (
            <tr {...props} className="border-b border-border last:border-b-0" />
          ),
          th: ({ node, style, ...props }: any) => (
            <th
              {...props}
              style={style}
              className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-border last:border-r-0"
            />
          ),
          td: ({ node, style, ...props }: any) => (
            <td
              {...props}
              style={style}
              className="px-3 py-2 align-top border-r border-border last:border-r-0 break-words"
            />
          ),
        }}
      >
        {normalizeAssistantMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
}
