import { cn } from "@/lib/utils";

interface Props {
  documentId?: string | null;
  documents: Array<{ id: string; file_name: string }>;
  className?: string;
  size?: "sm" | "xs";
  showLabel?: boolean;
}

/**
 * Renders the source document file name as plain (non-interactive) muted text.
 */
export function SourceDocumentLink({ documentId, documents, className, size = "sm", showLabel = true }: Props) {
  const doc = documentId ? documents.find((d) => d.id === documentId) : undefined;
  const fileName = doc?.file_name;
  const text = size === "xs" ? "text-[11px]" : "text-xs";

  let body: string;
  if (!documentId) body = "Not specified";
  else if (!fileName) body = "(unknown document)";
  else body = fileName;

  return (
    <span
      title={fileName ?? undefined}
      className={cn("inline-flex items-center gap-1 text-muted-foreground", text, className)}
    >
      {showLabel && <span className="font-medium text-foreground/70">Document:</span>}
      <span className="truncate">{body}</span>
    </span>
  );
}
