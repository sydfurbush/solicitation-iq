import { FileSignature } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContractStructure } from "../prompts/solicitationAnalysis";

interface Props {
  structure?: ContractStructure | null;
}

export function ContractStructureCard({ structure }: Props) {
  const rows: Array<[string, string | null | undefined]> = [
    ["Contract type", structure?.type],
    ["Base period", structure?.base_period],
    ["Option periods", structure?.option_periods],
    ["Ceiling value", structure?.ceiling_value],
    ["Pricing structure", structure?.pricing_structure],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-4 w-4 text-primary" />
          Contract structure
          {structure?.clins_detected && (
            <Badge variant="secondary" className="ml-2">CLINs detected</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!structure ? (
          <p className="text-sm text-muted-foreground italic">Not yet analyzed.</p>
        ) : (
          <dl className="space-y-2">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 border-b last:border-0 pb-2 last:pb-0">
                <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
                <dd className="text-sm font-medium text-right">{value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
