import { useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { type PhaseType } from "@/lib/validators/solicitation";
import { useDecideApproval, type PhaseApproval } from "../hooks/usePhaseApprovals";
import { APPROVAL_NOTE_MAX, validateNote } from "../validators";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Proposal Development",
};

type Mode = "idle" | "approve" | "changes";

export function ApprovalActionBanner({
  pending,
  solicitationId,
  deciderName,
}: {
  pending: PhaseApproval;
  solicitationId: string;
  deciderName?: string | null;
}) {
  const decide = useDecideApproval(solicitationId);
  const [mode, setMode] = useState<Mode>("idle");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const required = mode === "changes";
  const error = touched ? validateNote(note, required) : null;
  const remaining = APPROVAL_NOTE_MAX - note.length;
  const overLimit = note.length > APPROVAL_NOTE_MAX;

  const reset = () => {
    setMode("idle");
    setNote("");
    setTouched(false);
  };

  const submit = async () => {
    setTouched(true);
    const validation = validateNote(note, required);
    if (validation) return;
    try {
      await decide.mutateAsync({
        approvalId: pending.id,
        decision: required ? "changes_requested" : "approved",
        note: note.trim() || undefined,
        deciderName,
      });
      toast({
        title: required ? "Changes requested" : "Approved",
        description: required
          ? "Your account team has been notified."
          : `${PHASE_LABELS[pending.phase]} approved.`,
      });
      reset();
    } catch (e) {
      toast({
        title: required ? "Failed to send" : "Failed to approve",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold">{PHASE_LABELS[pending.phase]} deliverables are ready for your review</div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Please approve to let the team move to the next phase, or request changes.
            </p>
          </div>
        </div>

        {mode === "idle" ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setMode("approve")} disabled={decide.isPending}>
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode("changes")} disabled={decide.isPending}>
              Request changes
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="approval-note" className="text-sm">
                {required ? "What needs to change?" : "Add a note (optional)"}
                {required && <span className="text-destructive ml-1">*</span>}
              </Label>
              <span
                className={cn(
                  "text-xs",
                  overLimit ? "text-destructive" : "text-muted-foreground",
                )}
                aria-live="polite"
              >
                {remaining} characters left
              </span>
            </div>
            <Textarea
              id="approval-note"
              placeholder={required ? "Briefly describe what needs to change…" : "Optional context for the team"}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={3}
              maxLength={APPROVAL_NOTE_MAX + 50}
              aria-invalid={!!error}
              aria-describedby={error ? "approval-note-error" : undefined}
              className={cn(error && "border-destructive focus-visible:ring-destructive")}
            />
            {error && (
              <p id="approval-note-error" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={required ? "destructive" : "default"}
                onClick={submit}
                disabled={decide.isPending || overLimit || (required && !note.trim())}
              >
                {required ? "Send request" : "Confirm approval"}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={decide.isPending}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
