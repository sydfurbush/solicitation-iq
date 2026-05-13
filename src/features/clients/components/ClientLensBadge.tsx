import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useClientProfile } from "@/features/clients/hooks/useClientProfile";
import { getPreset } from "@/features/clients/lib/lensPresets";
import { Link } from "react-router-dom";

export function ClientLensBadge({ clientId, compact }: { clientId?: string; compact?: boolean }) {
  const { data: profile } = useClientProfile(clientId);
  if (!clientId) return null;

  if (!profile) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link to={`/clients/${clientId}?tab=ai-lens`}>
            <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-muted">
              <Sparkles className="h-3 w-3" /> No lens
            </Badge>
          </Link>
        </TooltipTrigger>
        <TooltipContent>Set up an AI Lens for this client</TooltipContent>
      </Tooltip>
    );
  }

  const preset = getPreset(profile.preset_key);
  const label = preset?.label ?? "Custom";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to={`/clients/${clientId}?tab=ai-lens`}>
          <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-secondary/80">
            <Sparkles className="h-3 w-3 text-primary" />
            {compact ? `Lens v${profile.version}` : `${label} lens · v${profile.version}`}
          </Badge>
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <div className="font-medium">AI Lens active</div>
          <div className="text-muted-foreground">{label} · {profile.naics_codes?.length ?? 0} NAICS · {profile.compliance_frameworks?.length ?? 0} frameworks</div>
          <div className="text-muted-foreground">Click to edit</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
