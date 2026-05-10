import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ANNOTATION_BADGE,
  ANNOTATION_ICON,
  ANNOTATION_LABEL,
  ANNOTATION_TYPES,
  type AnnotationType,
} from "../utils/annotationHelpers";

export interface AnnotationFormValues {
  annotation_type: AnnotationType;
  content: string;
  document_id: string | null;
  page_number: number | null;
}

interface Props {
  initial?: Partial<AnnotationFormValues>;
  documents?: Array<{ id: string; file_name: string }>;
  showDocumentSelect?: boolean;
  onSubmit: (values: AnnotationFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
  compact?: boolean;
}

export function AnnotationForm({
  initial,
  documents = [],
  showDocumentSelect = true,
  onSubmit,
  onCancel,
  submitting,
  compact,
}: Props) {
  const [type, setType] = useState<AnnotationType>(initial?.annotation_type ?? "note");
  const [content, setContent] = useState(initial?.content ?? "");
  const [documentId, setDocumentId] = useState<string | null>(initial?.document_id ?? null);
  const [page, setPage] = useState<string>(
    initial?.page_number ? String(initial.page_number) : ""
  );
  const [focused, setFocused] = useState(!compact);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSubmit({
      annotation_type: type,
      content: content.trim(),
      document_id: documentId,
      page_number: page ? Number(page) : null,
    });
  };

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="flex flex-wrap gap-1.5">
        {ANNOTATION_TYPES.map((t) => {
          const Icon = ANNOTATION_ICON[t];
          const active = t === type;
          return (
            <button
              type="button"
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs transition",
                active
                  ? cn(ANNOTATION_BADGE[t], "border-current font-medium")
                  : "bg-muted/30 text-muted-foreground hover:bg-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{ANNOTATION_LABEL[t]}</span>
            </button>
          );
        })}
      </div>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onFocus={() => setFocused(true)}
        rows={focused ? 3 : 2}
        placeholder="Add your annotation…"
      />

      {focused && showDocumentSelect && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Document</Label>
            <Select
              value={documentId ?? "none"}
              onValueChange={(v) => setDocumentId(v === "none" ? null : v)}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {documents.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.file_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Page</Label>
            <Input
              type="number"
              min={1}
              value={page}
              onChange={(e) => setPage(e.target.value)}
              placeholder="—"
              className="h-9"
            />
          </div>
        </div>
      )}

      {focused && (
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={!content.trim() || submitting}>
            {submitting ? "Saving…" : "Add annotation"}
          </Button>
        </div>
      )}
    </form>
  );
}
