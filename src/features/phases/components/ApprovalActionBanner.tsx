import { useState } from "react";
import { Check, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { type PhaseType } from "@/lib/validators/solicitation";
import { useDecideApproval, type PhaseApproval } from "../hooks/usePhaseApprovals";

const PHASE_LABELS: Record<PhaseType, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Outline",
  phase_4_win_themes: "Win Themes",
};

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
  const [showChanges, setShowChanges] = useState(false);
  const [note, setNote] = useState("");

  const handleApprove = async () => {
    try {
      await decide.mutateAsync({ approvalId: pending.id, decision: "approved", deciderName });
      toast({ title: "Approved", description: `${PHASE_LABELS[pending.phase]} approved.` });
    } catch (e) {
      toast({ title: "Failed to approve", description: String(e), variant: "destructive" });
    }
  };

  const handleRequest = async () => {
    if (!note.trim()) {
      toast({ title: "Add a note", description: "Briefly describe the changes needed.", variant: "destructive" });
      return;
    }
    try {
      await decide.mutateAsync({
        approvalId: pending.id,
        decision: "changes_requested",
        note: note.trim(),
        deciderName,
      });
      toast({ title: "Changes requested", description: "Your account team has been notified." });
      setShowChanges(false);
      setNote("");
    } catch (e) {
      toast({ title: "Failed to send", description: String(e), variant: "destructive" });
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

        {!showChanges ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={handleApprove} disabled={decide.isPending}>
              <Check className="h-4 w-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowChanges(true)} disabled={decide.isPending}>
              Request changes
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Textarea
              placeholder="What needs to change?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleRequest} disabled={decide.isPending}>
                Send request
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowChanges(false); setNote(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
