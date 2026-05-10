import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useCreateQuestion } from "../hooks/useStrategicQuestions";
import { QuestionForm } from "./QuestionForm";

interface Props {
  solicitationId: string;
  documents: Array<{ id: string; file_name: string }>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateQuestionDialog({ solicitationId, documents, open, onOpenChange }: Props) {
  const create = useCreateQuestion(solicitationId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add question</DialogTitle>
        </DialogHeader>
        <QuestionForm
          documents={documents}
          draftKey={`q-draft-${solicitationId}`}
          submitting={create.isPending}
          onCancel={() => onOpenChange(false)}
          onSubmit={async (v) => {
            try {
              await create.mutateAsync({
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
              toast({ title: "Question added" });
              onOpenChange(false);
            } catch (e) {
              toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
