import { useState } from "react";
import { format } from "date-fns";
import { Check, Quote, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { QuestionForm } from "./QuestionForm";
import {
  CATEGORY_LABEL,
  RECOMMENDATION_LABEL,
  getCategoryColor,
  getRecommendationColor,
  type QuestionRecommendation,
  type QuestionRow,
} from "../utils/questionHelpers";

interface Props {
  question: QuestionRow | null;
  documents: Array<{ id: string; file_name: string }>;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<QuestionRow>) => Promise<void> | void;
}

export function QuestionDetailPanel({ question, documents, onClose, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [responseDraft, setResponseDraft] = useState("");

  if (!question) return null;
  const rec = (question.recommendation ?? "monitor") as QuestionRecommendation;

  const handleToggleSubmitted = async () => {
    await onUpdate(question.id, {
      is_submitted: !question.is_submitted,
      submitted_at: !question.is_submitted ? new Date().toISOString() : null,
    });
  };

  const handleSaveResponse = async () => {
    await onUpdate(question.id, { agency_response: responseDraft || null });
    toast({ title: "Response saved" });
  };

  return (
    <Sheet open={!!question} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <SheetTitle>Question detail</SheetTitle>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className={getCategoryColor(question.category)}>
              {CATEGORY_LABEL[question.category]}
            </Badge>
            <Badge variant="outline" className={getRecommendationColor(rec)}>
              {RECOMMENDATION_LABEL[rec]}
            </Badge>
            <Badge variant="secondary">P{question.priority ?? 0}</Badge>
            {question.is_submitted && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                <Check className="h-3 w-3 mr-1" /> Submitted
                {question.submitted_at && ` ${format(new Date(question.submitted_at), "PP")}`}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {editing ? (
          <div className="mt-6">
            <QuestionForm
              initial={question}
              documents={documents}
              submitting={false}
              onCancel={() => setEditing(false)}
              onSubmit={async (v) => {
                await onUpdate(question.id, {
                  question_text: v.question_text,
                  category: v.category,
                  recommendation: v.recommendation,
                  priority: v.priority,
                  question_rationale: v.question_rationale || null,
                  source_document_id: v.source_document_id,
                  source_citation: v.source_citation || null,
                  source_quote: v.source_quote || null,
                  strategic_advantage_notes: v.strategic_advantage_notes || null,
                });
                toast({ title: "Question updated" });
                setEditing(false);
              }}
            />
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Question</Label>
              <p className="mt-1 text-sm font-medium leading-relaxed">{question.question_text}</p>
            </div>

            {question.question_rationale && (
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Rationale</Label>
                <p className="mt-1 text-sm whitespace-pre-wrap">{question.question_rationale}</p>
              </div>
            )}

            {question.source_quote && (
              <div>
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Source</Label>
                <blockquote className="mt-1 border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
                  <Quote className="inline h-3 w-3 mr-1" />
                  {question.source_quote}
                </blockquote>
                {question.source_citation && (
                  <p className="mt-1 text-xs text-muted-foreground">{question.source_citation}</p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Strategic notes</Label>
              <Textarea
                rows={3}
                defaultValue={question.strategic_advantage_notes ?? ""}
                onBlur={(e) => onUpdate(question.id, { strategic_advantage_notes: e.target.value || null })}
                placeholder="Internal strategic notes..."
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setEditing(true)}>Edit</Button>
              <Button onClick={handleToggleSubmitted}>
                {question.is_submitted ? "Mark as not submitted" : "Mark as submitted"}
              </Button>
            </div>

            {question.is_submitted && (
              <div className="border-t pt-4 space-y-2">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Agency response</Label>
                <Textarea
                  rows={4}
                  defaultValue={question.agency_response ?? ""}
                  onChange={(e) => setResponseDraft(e.target.value)}
                  placeholder="Paste agency response here..."
                />
                <Button size="sm" onClick={handleSaveResponse}>Save response</Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
