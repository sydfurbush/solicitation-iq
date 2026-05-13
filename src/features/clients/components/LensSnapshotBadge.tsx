import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { ClientLensBadge } from "./ClientLensBadge";
import { getPreset } from "@/features/clients/lib/lensPresets";

export interface LensSnapshot {
  preset_key?: string | null;
  label?: string | null;
  version?: number | null;
  overridden?: boolean | null;
  topic?: string | null;
  captured_at?: string | null;
}

/**
 * Renders a badge showing which Client Lens shaped a saved AI artifact.
 * Prefers a stored snapshot (captured at generation time); otherwise falls
 * back to the live ClientLensBadge for the given clientId.
 */
export function LensSnapshotBadge({
  snapshot,
  clientId,
  compact,
}: {
  snapshot?: LensSnapshot | null;
  clientId?: string | null;
  compact?: boolean;
}) {
  if (!snapshot || (!snapshot.preset_key && !snapshot.label && !snapshot.version)) {
    return <ClientLensBadge clientId={clientId ?? undefined} compact={compact} />;
  }

  const preset = snapshot.preset_key ? getPreset(snapshot.preset_key) : undefined;
  const label = snapshot.label ?? preset?.label ?? "Custom";
  const version = snapshot.version ?? 1;
  const text = compact ? `Lens v${version}` : `${label} lens · v${version}`;

  const inner = (
    <Badge variant="secondary" className={`gap-1 ${clientId ? "cursor-pointer hover:bg-secondary/80" : ""}`}>
      <Sparkles className="h-3 w-3 text-primary" />
      {text}
      {snapshot.overridden ? <span className="ml-1 text-[10px] uppercase opacity-70">override</span> : null}
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {clientId ? <Link to={`/clients/${clientId}?tab=ai-lens`}>{inner}</Link> : <span>{inner}</span>}
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <div className="font-medium">Shaped by Client Lens</div>
          <div className="text-muted-foreground">
            {label} · v{version}{snapshot.overridden ? " (solicitation override applied)" : ""}
          </div>
          {snapshot.captured_at && (
            <div className="text-muted-foreground">
              Captured {new Date(snapshot.captured_at).toLocaleDateString()}
            </div>
          )}
          {clientId && <div className="text-muted-foreground">Click to view lens</div>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
