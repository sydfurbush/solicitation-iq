import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
  type QuestionRow,
  type QuestionCategory,
  type QuestionRecommendation,
} from "../utils/questionHelpers";

export interface QuestionFormValues {
  question_text: string;
  category: QuestionCategory;
  recommendation: QuestionRecommendation;
  priority: number;
  question_rationale: string;
  source_document_id: string | null;
  source_citation: string;
  source_quote: string;
  strategic_advantage_notes: string;
}

interface Props {
  initial?: Partial<QuestionRow>;
  documents: Array<{ id: string; file_name: string }>;
  draftKey?: string;
  onSubmit: (values: QuestionFormValues) => void;
  onCancel?: () => void;
  submitting?: boolean;
}

const empty: QuestionFormValues = {
  question_text: "",
  category: "clarification",
  recommendation: "ask",
  priority: 50,
  question_rationale: "",
  source_document_id: null,
  source_citation: "",
  source_quote: "",
  strategic_advantage_notes: "",
};

export function QuestionForm({ initial, documents, draftKey, onSubmit, onCancel, submitting }: Props) {
  const [values, setValues] = useState<QuestionFormValues>(() => {
    if (draftKey) {
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem(draftKey) : null;
      if (stored) try { return { ...empty, ...JSON.parse(stored) }; } catch { /* noop */ }
    }
    return {
      ...empty,
      ...(initial ?? {}),
      question_text: initial?.question_text ?? "",
      category: (initial?.category ?? "clarification") as QuestionCategory,
      recommendation: (initial?.recommendation ?? "ask") as QuestionRecommendation,
      priority: initial?.priority ?? 50,
      question_rationale: initial?.question_rationale ?? "",
      source_document_id: initial?.source_document_id ?? null,
      source_citation: initial?.source_citation ?? "",
      source_quote: initial?.source_quote ?? "",
      strategic_advantage_notes: initial?.strategic_advantage_notes ?? "",
    } as QuestionFormValues;
  });

  useEffect(() => {
    if (!draftKey) return;
    const t = setTimeout(() => localStorage.setItem(draftKey, JSON.stringify(values)), 400);
    return () => clearTimeout(t);
  }, [values, draftKey]);

  const set = <K extends keyof QuestionFormValues>(k: K, v: QuestionFormValues[K]) =>
    setValues((s) => ({ ...s, [k]: v }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.question_text.trim()) return;
    onSubmit(values);
    if (draftKey) localStorage.removeItem(draftKey);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1">
        <Label>Question text *</Label>
        <Textarea
          required
          rows={3}
          value={values.question_text}
          onChange={(e) => set("question_text", e.target.value)}
          placeholder="Submission-ready question to send to the agency..."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Category</Label>
          <Select value={values.category} onValueChange={(v) => set("category", v as QuestionCategory)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Recommendation</Label>
          <Select value={values.recommendation} onValueChange={(v) => set("recommendation", v as QuestionRecommendation)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RECOMMENDATIONS.map((r) => <SelectItem key={r} value={r}>{RECOMMENDATION_LABEL[r]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label>Priority</Label>
          <span className="text-xs text-muted-foreground tabular-nums">{values.priority}</span>
        </div>
        <Slider
          min={1}
          max={100}
          value={[values.priority]}
          onValueChange={([v]) => set("priority", v)}
        />
      </div>

      <div className="space-y-1">
        <Label>Rationale</Label>
        <Textarea rows={2} value={values.question_rationale} onChange={(e) => set("question_rationale", e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Source document</Label>
          <Select
            value={values.source_document_id ?? "none"}
            onValueChange={(v) => set("source_document_id", v === "none" ? null : v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {documents.map((d) => <SelectItem key={d.id} value={d.id}>{d.file_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Source citation</Label>
          <input
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Section L.5.2, p. 14"
            value={values.source_citation}
            onChange={(e) => set("source_citation", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label>Source quote</Label>
        <Textarea rows={2} value={values.source_quote} onChange={(e) => set("source_quote", e.target.value)} placeholder="Exact text from the document..." />
      </div>

      <div className="space-y-1">
        <Label>Strategic notes</Label>
        <Textarea rows={2} value={values.strategic_advantage_notes} onChange={(e) => set("strategic_advantage_notes", e.target.value)} />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={submitting || !values.question_text.trim()}>Save question</Button>
      </div>
    </form>
  );
}
