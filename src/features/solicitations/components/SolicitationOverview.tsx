import { format } from "date-fns";
import {
  Calendar,
  DollarSign,
  FileText,
  Sparkles,
  Tag,
  Upload,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatRange } from "../lib/format";
import type { SolicitationRow } from "../hooks/useSolicitations";

interface Props {
  solicitation: SolicitationRow;
  onUploadDocs?: () => void;
  onRunAnalysis?: () => void;
  onGenerateQuestions?: () => void;
}

function DateRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {value ? format(new Date(value), "MMM d, yyyy") : "—"}
      </span>
    </div>
  );
}

export function SolicitationOverview({
  solicitation: s,
  onUploadDocs,
  onRunAnalysis,
  onGenerateQuestions,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Key dates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DateRow label="Released" value={s.release_date} />
            <DateRow label="Questions due" value={s.questions_due_date} />
            <DateRow label="Proposal due" value={s.proposal_due_date} />
            <DateRow label="Expected award" value={s.expected_award_date} />
            <DateRow label="PoP start" value={s.period_of_performance_start} />
            <DateRow label="PoP end" value={s.period_of_performance_end} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Financials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated value</span>
              <span className="font-medium">
                {formatRange(s.estimated_value_low, s.estimated_value_high)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contract type</span>
              <span className="font-medium">{s.contract_type ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Agency type</span>
              <span className="font-medium">{s.agency_type ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Set-aside</span>
              <span className="font-medium">{s.set_aside ?? "—"}</span>
            </div>
          </CardContent>
        </Card>

        {s.has_incumbent && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Incumbent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium">{s.incumbent_name ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contract #</span>
                <span className="font-medium font-mono text-xs">
                  {s.incumbent_contract_number ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Value</span>
                <span className="font-medium">
                  {formatCurrency(s.incumbent_contract_value)}
                </span>
              </div>
              {s.incumbent_performance_notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground mb-1">Performance notes</p>
                  <p className="text-sm whitespace-pre-wrap">{s.incumbent_performance_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {s.tags && s.tags.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag className="h-4 w-4" /> Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {s.tags.map((t) => (
                <Badge key={t} variant="secondary">
                  {t}
                </Badge>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> AI summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {s.ai_summary ? (
              <p className="text-sm whitespace-pre-wrap">{s.ai_summary}</p>
            ) : (
              <div className="text-sm text-muted-foreground py-6 text-center border-2 border-dashed rounded-md">
                Analysis not yet run. Upload documents and run analysis to generate a summary.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Key requirements</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(s.key_requirements) && s.key_requirements.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {(s.key_requirements as Array<{ title?: string }>).map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-muted-foreground">{i + 1}.</span>
                      <span>{r.title ?? JSON.stringify(r)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No requirements extracted yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Evaluation factors</CardTitle>
            </CardHeader>
            <CardContent>
              {Array.isArray(s.evaluation_factors) && s.evaluation_factors.length > 0 ? (
                <ul className="space-y-2 text-sm">
                  {(s.evaluation_factors as Array<{ name?: string; weight?: number }>).map((f, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{f.name ?? `Factor ${i + 1}`}</span>
                      {f.weight != null && (
                        <span className="text-muted-foreground">{f.weight}%</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No factors extracted yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onUploadDocs}>
              <Upload className="mr-2 h-4 w-4" /> Upload documents
            </Button>
            <Button variant="outline" onClick={onRunAnalysis}>
              <Wand2 className="mr-2 h-4 w-4" /> Run analysis
            </Button>
            <Button variant="outline" onClick={onGenerateQuestions}>
              <FileText className="mr-2 h-4 w-4" /> Generate questions
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
