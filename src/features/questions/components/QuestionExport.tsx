import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORY_LABEL, RECOMMENDATION_LABEL, questionsToCsv, type QuestionRow } from "../utils/questionHelpers";

interface Props {
  questions: QuestionRow[];
  selectedIds?: string[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

type Scope = "all" | "selected" | "submitted" | "not_submitted";

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildText(qs: QuestionRow[], opts: { rationale: boolean; citations: boolean; notes: boolean }) {
  return qs
    .map((q, i) => {
      const lines: string[] = [`${i + 1}. ${q.question_text}`];
      lines.push(`   Category: ${CATEGORY_LABEL[q.category]}  ·  Recommendation: ${q.recommendation ? RECOMMENDATION_LABEL[q.recommendation] : "—"}`);
      if (opts.rationale && q.question_rationale) lines.push(`   Rationale: ${q.question_rationale}`);
      if (opts.citations && (q.source_citation || q.source_quote)) {
        if (q.source_citation) lines.push(`   Source: ${q.source_citation}`);
        if (q.source_quote) lines.push(`   Quote: "${q.source_quote}"`);
      }
      if (opts.notes && q.strategic_advantage_notes) lines.push(`   Notes: ${q.strategic_advantage_notes}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function QuestionExport({ questions, selectedIds = [], trigger, open, onOpenChange }: Props) {
  const [scope, setScope] = useState<Scope>("all");
  const [format, setFormat] = useState<"csv" | "txt" | "json">("csv");
  const [includeRationale, setIncludeRationale] = useState(true);
  const [includeCitations, setIncludeCitations] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);

  const handleExport = () => {
    let pool = questions;
    if (scope === "selected") pool = pool.filter((q) => selectedIds.includes(q.id));
    else if (scope === "submitted") pool = pool.filter((q) => q.is_submitted);
    else if (scope === "not_submitted") pool = pool.filter((q) => !q.is_submitted);

    if (format === "csv") downloadFile(questionsToCsv(pool), "questions.csv", "text/csv");
    else if (format === "json") downloadFile(JSON.stringify(pool, null, 2), "questions.json", "application/json");
    else downloadFile(buildText(pool, { rationale: includeRationale, citations: includeCitations, notes: includeNotes }), "questions.txt", "text/plain");

    onOpenChange?.(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Export questions</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All questions</SelectItem>
                <SelectItem value="selected" disabled={selectedIds.length === 0}>Selected ({selectedIds.length})</SelectItem>
                <SelectItem value="submitted">Submitted only</SelectItem>
                <SelectItem value="not_submitted">Not submitted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as "csv" | "txt" | "json")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (Excel)</SelectItem>
                <SelectItem value="txt">Text (formatted for submission)</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {format === "txt" && (
            <div className="space-y-2">
              <Label>Include</Label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeRationale} onCheckedChange={(c) => setIncludeRationale(c === true)} />
                Rationale
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeCitations} onCheckedChange={(c) => setIncludeCitations(c === true)} />
                Source citations
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={includeNotes} onCheckedChange={(c) => setIncludeNotes(c === true)} />
                Strategic notes (internal)
              </label>
            </div>
          )}
          <Button className="w-full" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
