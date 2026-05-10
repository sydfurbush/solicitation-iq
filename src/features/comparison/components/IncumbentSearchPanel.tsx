import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, History } from "lucide-react";
import { LinkPriorSolicitationDialog } from "./LinkPriorSolicitationDialog";
import { useSolicitation } from "@/features/solicitations/hooks/useSolicitations";

export function IncumbentSearchPanel({ solicitationId }: { solicitationId: string }) {
  const { data: sol } = useSolicitation(solicitationId);
  if (!sol?.has_incumbent) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <CardTitle>Incumbent detected</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md bg-muted/30 border p-3 text-sm space-y-1">
          {sol.incumbent_name && (
            <p><span className="text-muted-foreground">Name:</span> <span className="font-medium">{sol.incumbent_name}</span></p>
          )}
          {sol.incumbent_contract_number && (
            <p><span className="text-muted-foreground">Contract:</span> <Badge variant="secondary" className="font-mono text-xs">{sol.incumbent_contract_number}</Badge></p>
          )}
          {sol.incumbent_contract_value != null && (
            <p><span className="text-muted-foreground">Value:</span> ${Number(sol.incumbent_contract_value).toLocaleString()}</p>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Link the prior solicitation to compare changes and identify strategic openings.
        </p>
        <LinkPriorSolicitationDialog
          solicitationId={solicitationId}
          trigger={<Button><Search className="mr-2 h-4 w-4" /> Search for prior solicitation</Button>}
        />
      </CardContent>
    </Card>
  );
}
