import { FileText, ExternalLink } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";

interface Props {
  documentId?: string | null;
  documents: Array<{ id: string; file_name: string }>;
  className?: string;
  size?: "sm" | "xs";
}

/**
 * Renders the source document file name for a question.
 * Clicking navigates the current solicitation to the Documents step
 * (and preserves a `doc=<id>` hint for future deep-linking).
 */
export function SourceDocumentLink({ documentId, documents, className, size = "sm" }: Props) {
  const [params, setParams] = useSearchParams();
  const doc = documentId ? documents.find((d) => d.id === documentId) : undefined;
  const fileName = doc?.file_name;
  const text = size === "xs" ? "text-[11px]" : "text-xs";

  if (!documentId) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-muted-foreground italic", text, className)}>
        <FileText className="h-3 w-3" />
        Document not specified
      </span>
    );
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const next = new URLSearchParams(params);
    next.set("tab", "phase-1");
    next.set("step", "documents");
    next.set("doc", documentId);
    setParams(next);
  };

  return (
    <button
      type="button"
      onClick={handleOpen}
      title={fileName ?? "Open source document"}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 font-medium text-foreground hover:bg-muted hover:border-primary/40 transition max-w-full",
        text,
        className,
      )}
    >
      <FileText className="h-3 w-3 shrink-0" />
      <span className="truncate">{fileName ?? "(unknown document)"}</span>
      <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
    </button>
  );
}
