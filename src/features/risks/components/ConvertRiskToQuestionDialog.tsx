import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import type { RiskRow } from "@/features/risks/hooks/useRisks";
import { useCreateQuestion } from "@/features/questions/hooks/useStrategicQuestions";

type Category =
  | "clarification"
  | "strategic"
  | "scope_expansion"
  | "risk_concern"
  | "compliance"
  | "other";

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "clarification", label: "Clarification" },
  { value: "risk_concern", label: "Risk concern" },
  { value: "compliance", label: "Compliance" },
  { value: "scope_expansion", label: "Scope expansion" },
  { value: "strategic", label: "Strategic" },
  { value: "other", label: "Other" },
];

function priorityFromSeverity(sev: RiskRow["severity"]): number {
  switch (sev) {
    case "critical": return 90;
    case "high": return 75;
    case "medium": return 55;
    case "low": return 35;
    default: return 25;
  }
}

function defaultQuestionText(risk: RiskRow): string {
  const subj = risk.title.replace(/[.?!]+$/, "");
  return `Regarding "${subj}": can the agency clarify their expectations, acceptable approaches, or any flexibility on this requirement?`;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  risk: RiskRow;
  solicitationId: string;
  onConverted?: () => void;
}

export function ConvertRiskToQuestionDialog({
  open,
  onOpenChange,
  risk,
  solicitationId,
  onConverted,
}: Props) {
  const create = useCreateQuestion(solicitationId);
  const [questionText, setQuestionText] = useState(defaultQuestionText(risk));
  const [category, setCategory] = useState<Category>("clarification");

  const handleSubmit = async () => {
    const text = questionText.trim();
    if (text.length < 5) {
      toast({ title: "Question is too short", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        question_text: text,
        category,
        recommendation: "ask",
        priority: priorityFromSeverity(risk.severity),
        question_rationale: `Created from risk: ${risk.title}`,
        source_citation: risk.source_citation ?? null,
        source_quote: risk.source_quote ?? null,
        strategic_advantage_notes: `From risk [${risk.id}]: ${risk.title}`,
      });
      toast({
        title: "Added to Questions",
        description: "The risk was converted into a clarification question.",
      });
      onConverted?.();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Failed to add question",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask the agency</DialogTitle>
          <DialogDescription>
            Convert this risk into a clarification question for the agency. It will appear in the Questions tab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Question</Label>
            <Textarea
              rows={4}
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Priority will be set to <strong>{priorityFromSeverity(risk.severity)}</strong>{" "}
            (based on risk severity: {risk.severity}).
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add to Questions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
