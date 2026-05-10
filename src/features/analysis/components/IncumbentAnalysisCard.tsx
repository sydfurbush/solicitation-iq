import { Search, UserSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { IncumbentInfo } from "../prompts/solicitationAnalysis";

interface Props {
  info?: IncumbentInfo | null;
  fallbackName?: string | null;
  fallbackContractNumber?: string | null;
}

export function IncumbentAnalysisCard({ info, fallbackName, fallbackContractNumber }: Props) {
  const detected = info?.detected ?? Boolean(fallbackName);
  const name = info?.name ?? fallbackName ?? null;
  const contractNumber = info?.contract_number ?? fallbackContractNumber ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserSquare className="h-4 w-4 text-primary" />
          Incumbent analysis
          <Badge variant={detected ? "default" : "outline"} className="ml-2">
            {detected ? "Detected" : "Not detected"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {detected ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Incumbent</p>
                <p className="font-medium">{name ?? "Unknown"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Contract #</p>
                <p className="font-mono text-xs">{contractNumber ?? "—"}</p>
              </div>
            </div>
            {info?.indicators && info.indicators.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Signals</p>
                <ul className="text-xs space-y-1">
                  {info.indicators.map((ind, i) => (
                    <li key={i} className="flex gap-2"><span className="text-primary">•</span>{ind}</li>
                  ))}
                </ul>
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full">
              <Search className="h-4 w-4 mr-2" /> Search for prior solicitation
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            No incumbent detected from the documents. You can record incumbent details manually from the Overview tab.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
