import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Pencil, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClient } from "@/features/clients/hooks/useClients";

type Capabilities = {
  core_capabilities?: string;
  naics_codes?: string[];
  certifications?: string[];
  differentiators?: string;
  past_performance?: string;
  key_personnel?: string;
  teaming_partners?: string;
  notes?: string;
};

function parse(metadata: unknown): Capabilities | null {
  const caps = (metadata as Record<string, unknown> | null)?.capabilities;
  if (!caps) return null;
  if (typeof caps === "string") return { core_capabilities: caps };
  if (typeof caps === "object") return caps as Capabilities;
  return null;
}

interface Props {
  clientId?: string | null;
  /** Timestamp the gap analysis was last run, ISO string */
  gapsUpdatedAt?: string | null;
}

export function CapabilitiesProfileCard({ clientId, gapsUpdatedAt }: Props) {
  const { data: client } = useClient(clientId ?? undefined);
  const caps = useMemo(() => parse(client?.metadata), [client?.metadata]);

  const clientUpdated = client?.updated_at ? new Date(client.updated_at) : null;
  const gapsUpdated = gapsUpdatedAt ? new Date(gapsUpdatedAt) : null;
  const isStale = !!(clientUpdated && gapsUpdated && clientUpdated > gapsUpdated);

  return (
    <Card className="border-dashed">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            Capabilities profile in use
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {client ? `${client.name} · ` : ""}
            {clientUpdated ? `Last edited ${clientUpdated.toLocaleString()}` : "No edits recorded"}
            {isStale && (
              <span className="ml-2 text-amber-600 font-medium">Profile changed since last gap analysis — regenerate to refresh</span>
            )}
          </p>
        </div>
        {clientId && (
          <Button asChild size="sm" variant="ghost">
            <Link to={`/clients/${clientId}`}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-2">
        {!caps ? (
          <p>No capabilities profile yet. Add one on the client page so gap analysis has something to compare against.</p>
        ) : (
          <>
            {caps.core_capabilities && <p><span className="font-medium text-foreground">Core:</span> {caps.core_capabilities}</p>}
            {caps.differentiators && <p><span className="font-medium text-foreground">Differentiators:</span> {caps.differentiators}</p>}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {caps.naics_codes?.map((n) => <Badge key={`n-${n}`} variant="secondary" className="font-mono text-[10px]">NAICS {n}</Badge>)}
              {caps.certifications?.map((c) => <Badge key={`c-${c}`} variant="outline" className="text-[10px]">{c}</Badge>)}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
