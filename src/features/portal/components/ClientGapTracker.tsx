import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, HelpCircle, Loader2, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useClientGaps, useUpdateClientGap, type ClientGap } from "@/features/portal/hooks/useClientGaps";

const SEV: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  medium: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  low: "bg-muted text-muted-foreground",
};

interface Props {
  solicitationId: string;
  canEdit: boolean;
}

export function ClientGapTracker({ solicitationId, canEdit }: Props) {
  const { data: gaps = [], isLoading } = useClientGaps(solicitationId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">Loading gaps…</CardContent>
      </Card>
    );
  }

  if (gaps.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          No capability gaps have been sent to you for review.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div>
          <h3 className="font-semibold">Capability gaps</h3>
          <p className="text-xs text-muted-foreground">
            Confirm whether your team can cover these requirements, or share context our analyst can use.
          </p>
        </div>
        <div className="space-y-3">
          {gaps.map((g) =>
            canEdit ? (
              <EditableGap key={g.id} gap={g} solicitationId={solicitationId} />
            ) : (
              <ReadOnlyGap key={g.id} gap={g} />
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function GapHeader({ gap }: { gap: ClientGap }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Badge className={cn("border", SEV[gap.severity] ?? "")} variant="outline">
        {gap.severity}
      </Badge>
      <Badge variant="secondary" className="capitalize text-[10px]">
        {gap.gap_type.replace("_", " ")}
      </Badge>
    </div>
  );
}

function ReadOnlyGap({ gap }: { gap: ClientGap }) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <GapHeader gap={gap} />
      <p className="font-medium text-sm">{gap.title}</p>
      {gap.description && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{gap.description}</p>}
      <Badge variant="outline" className="text-[10px] gap-1">
        <Lock className="h-3 w-3" /> View only
      </Badge>
    </div>
  );
}

function EditableGap({ gap, solicitationId }: { gap: ClientGap; solicitationId: string }) {
  const update = useUpdateClientGap(solicitationId);
  const [response, setResponse] = useState(gap.client_response ?? "");
  const [confirmed, setConfirmed] = useState<boolean | null>(
    gap.client_confirmed === undefined ? null : gap.client_confirmed
  );
  const initialResp = gap.client_response ?? "";
  const initialConf = gap.client_confirmed === undefined ? null : gap.client_confirmed;
  const dirty = response !== initialResp || confirmed !== initialConf;
  const hasResponded = gap.client_responded_at != null;

  const save = async () => {
    try {
      await update.mutateAsync({
        id: gap.id,
        client_confirmed: confirmed,
        client_response: response.trim() ? response : null,
      });
      toast({ title: "Response saved" });
    } catch (e) {
      toast({
        title: "Could not save",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    }
  };

  return (
    <div
      className={cn(
        "rounded-md border p-3 space-y-3",
        hasResponded
          ? "bg-emerald-500/5 border-emerald-500/30"
          : "border-blue-500/40 bg-blue-500/5"
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <GapHeader gap={gap} />
        {!hasResponded && (
          <Badge variant="outline" className="text-[10px] border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
            Needs your input
          </Badge>
        )}
        {hasResponded && (
          <Badge variant="outline" className="text-[10px] border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Responded
          </Badge>
        )}
      </div>
      <p className="font-medium text-sm">{gap.title}</p>
      {gap.description && (
        <p className="text-xs text-muted-foreground whitespace-pre-wrap">{gap.description}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <ChoiceButton
          active={confirmed === true}
          onClick={() => setConfirmed(true)}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          label="We have this"
        />
        <ChoiceButton
          active={confirmed === false}
          onClick={() => setConfirmed(false)}
          icon={<XCircle className="h-3.5 w-3.5" />}
          label="Real gap"
        />
        <ChoiceButton
          active={confirmed === null}
          onClick={() => setConfirmed(null)}
          icon={<HelpCircle className="h-3.5 w-3.5" />}
          label="Not sure"
        />
      </div>

      <Textarea
        rows={3}
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Add context — past performance, partners, certifications, or anything else our analyst should know."
      />

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>
          {update.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Save response
        </Button>
      </div>
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background hover:bg-muted"
      )}
    >
      {icon}
      {label}
    </button>
  );
}
