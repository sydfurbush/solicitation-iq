import { useMemo, useState } from "react";
import { Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import type { QuestionRow } from "../utils/questionHelpers";
import { invalidateQuestionCounts } from "../hooks/useStrategicQuestions";

interface Props {
  solicitationId: string;
  questions: QuestionRow[];
}

const MIN_LEN = 20;

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ").replace(/[?.!]+$/, "");
}

export function CleanupQuestionsButton({ solicitationId, questions }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const { malformedIds, duplicateIds, nearDupGroups } = useMemo(() => {
    const ai = questions.filter((q) => q.is_ai_generated);
    const malformed: string[] = [];
    const dupes: string[] = [];
    const seen = new Map<string, QuestionRow>();
    const quoteGroups = new Map<string, QuestionRow[]>();

    // Sort by created_at asc so we keep the earliest
    const sorted = [...ai].sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "")
    );

    for (const q of sorted) {
      const text = (q.question_text ?? "").trim();
      if (text.length < MIN_LEN) {
        malformed.push(q.id);
        continue;
      }
      const key = normalize(text);
      if (seen.has(key)) {
        dupes.push(q.id);
      } else {
        seen.set(key, q);
      }
      const quote = (q.source_quote ?? "").trim();
      if (quote.length > 30) {
        const arr = quoteGroups.get(quote) ?? [];
        arr.push(q);
        quoteGroups.set(quote, arr);
      }
    }

    const nearDupGroupCount = Array.from(quoteGroups.values()).filter(
      (g) => g.length > 1
    ).length;

    return {
      malformedIds: malformed,
      duplicateIds: dupes,
      nearDupGroups: nearDupGroupCount,
    };
  }, [questions]);

  const toDelete = [...new Set([...malformedIds, ...duplicateIds])];
  const total = toDelete.length;

  const handleConfirm = async () => {
    if (total === 0) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase
        .from("strategic_questions")
        .delete()
        .in("id", toDelete);
      if (error) throw error;
      invalidateQuestionCounts(qc, solicitationId);
      toast({
        title: "Cleanup complete",
        description: `Removed ${malformedIds.length} malformed and ${duplicateIds.length} duplicate question${total === 1 ? "" : "s"}.`,
      });
      setOpen(false);
    } catch (e) {
      toast({
        title: "Cleanup failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={questions.filter((q) => q.is_ai_generated).length === 0}
      >
        <Sparkles className="h-4 w-4 mr-1" /> Cleanup
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Clean up AI questions
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  This will remove low-quality and duplicate AI-generated
                  questions. Manual questions are not affected.
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <strong>{malformedIds.length}</strong> malformed
                    {" "}(shorter than {MIN_LEN} characters)
                  </li>
                  <li>
                    <strong>{duplicateIds.length}</strong> exact duplicate{duplicateIds.length === 1 ? "" : "s"}
                    {" "}(keeps the earliest copy)
                  </li>
                  <li className="text-muted-foreground">
                    <strong>{nearDupGroups}</strong> near-duplicate group{nearDupGroups === 1 ? "" : "s"} detected
                    by shared source quote — left alone for manual review
                  </li>
                </ul>
                <p className="font-medium">
                  Total to delete: {total}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={busy || total === 0}>
              {busy ? "Cleaning…" : `Delete ${total}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
