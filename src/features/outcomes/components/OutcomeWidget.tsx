import { useEffect, useState } from "react";
import { Trophy, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  useSolicitationOutcome,
  useUpsertOutcome,
  type OutcomeStatus,
} from "../hooks/useSolicitationOutcome";

const OPTIONS: Array<{ value: OutcomeStatus; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "no_bid", label: "No bid" },
  { value: "withdrawn", label: "Withdrawn" },
];

const BADGE_VARIANT: Record<OutcomeStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary",
  won: "default",
  lost: "destructive",
  no_bid: "outline",
  withdrawn: "outline",
};

export function OutcomeWidget({ solicitationId }: { solicitationId: string }) {
  const { data, isLoading } = useSolicitationOutcome(solicitationId);
  const upsert = useUpsertOutcome(solicitationId);

  const [outcome, setOutcome] = useState<OutcomeStatus>("pending");
  const [awardedValue, setAwardedValue] = useState("");
  const [awardedAt, setAwardedAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (data) {
      setOutcome(data.outcome);
      setAwardedValue(data.awarded_value != null ? String(data.awarded_value) : "");
      setAwardedAt(data.awarded_at ?? "");
      setNotes(data.notes ?? "");
    }
  }, [data]);

  const onSave = async () => {
    try {
      await upsert.mutateAsync({
        outcome,
        awarded_value: awardedValue ? Number(awardedValue) : null,
        awarded_at: awardedAt || null,
        notes: notes.trim() || null,
      });
      toast({ title: "Outcome saved" });
    } catch (e) {
      toast({ title: "Could not save outcome", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Trophy className="h-4 w-4" /> Outcome
          </span>
          {data && <Badge variant={BADGE_VARIANT[data.outcome]}>{OPTIONS.find((o) => o.value === data.outcome)?.label}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={outcome} onValueChange={(v) => setOutcome(v as OutcomeStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="awarded-at">Award date</Label>
                <Input id="awarded-at" type="date" value={awardedAt} onChange={(e) => setAwardedAt(e.target.value)} disabled={outcome !== "won"} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="awarded-value">Awarded value (USD)</Label>
              <Input id="awarded-value" type="number" min="0" step="1000" value={awardedValue} onChange={(e) => setAwardedValue(e.target.value)} disabled={outcome !== "won"} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outcome-notes">Notes</Label>
              <Textarea id="outcome-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <Button onClick={onSave} disabled={upsert.isPending} size="sm" className="w-full">
              {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save outcome"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
