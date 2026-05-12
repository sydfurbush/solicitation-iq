import { Sparkles, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useWinThemes, useGenerateWinThemes, useUpdateWinTheme, useDeleteWinTheme } from "@/features/winthemes/hooks/useWinThemes";
import { AdvancePhaseButton } from "@/features/phases/components/AdvancePhaseButton";
import { ExportMenu } from "@/features/exports/components/ExportMenu";
import { ExportHistoryButton } from "@/features/exports/components/ExportHistoryButton";
import type { ExportDocument, ExportSection } from "@/features/exports/lib/exporters";

export default function SolicitationWinThemes({ solicitationId, currentPhase, solicitationTitle, clientName }: { solicitationId: string; currentPhase: string; solicitationTitle?: string; clientName?: string }) {
  const { data: themes = [], isLoading } = useWinThemes(solicitationId);
  const gen = useGenerateWinThemes(solicitationId);
  const update = useUpdateWinTheme(solicitationId);
  const del = useDeleteWinTheme(solicitationId);

  const buildExport = (): ExportDocument | null => {
    if (themes.length === 0) return null;
    const approved = themes.filter((t) => t.status === "approved");
    const exportable = approved.length > 0 ? approved : themes;

    const sections: ExportSection[] = exportable.map((t) => {
      const children: ExportSection[] = [];
      if (t.theme_statement) children.push({ heading: "Theme statement", paragraphs: [t.theme_statement] });
      if (t.discriminators?.length) children.push({ heading: "Discriminators", bullets: t.discriminators });
      if (t.proof_points?.length) children.push({ heading: "Proof points", bullets: t.proof_points });
      if (t.ghosting_points?.length) children.push({ heading: "Ghosting points", bullets: t.ghosting_points });
      return {
        heading: `${t.title}  (${t.status})`,
        children,
      };
    });

    return {
      title: "Win Themes",
      subtitle: `${exportable.length} ${approved.length > 0 ? "approved" : "candidate"} theme${exportable.length === 1 ? "" : "s"}`,
      filenameBase: "win_themes",
      sections,
      cover: { clientName, solicitationTitle, phase: currentPhase },
    };
  };

  const run = async () => {
    try {
      const r = await gen.mutateAsync();
      toast({ title: "Themes generated", description: `${r.inserted} candidate themes` });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Win themes</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">{themes.length} themes · {themes.filter((t) => t.status === "approved").length} approved</p>
          </div>
          <div className="flex gap-2">
            <ExportMenu build={buildExport} disabled={themes.length === 0} label="Export themes" solicitationId={solicitationId} kind="win-themes" />
            <ExportHistoryButton solicitationId={solicitationId} kind="win-themes" />
            <Button onClick={run} disabled={gen.isPending}>
              {gen.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate suggestions
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> :
            themes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No themes yet. Click "Generate suggestions" to draft win themes.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {themes.map((t) => (
                  <div key={t.id} className="border rounded-md p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-sm">{t.title}</h3>
                        <Badge
                          variant="outline"
                          className={
                            t.status === "approved" ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 mt-1" :
                            t.status === "rejected" ? "bg-destructive/15 text-destructive border-destructive/30 mt-1" :
                            "mt-1"
                          }
                        >
                          {t.status}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => update.mutate({ id: t.id, patch: { status: "approved" } })}>
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => update.mutate({ id: t.id, patch: { status: "rejected" } })}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {t.theme_statement && <p className="text-xs">{t.theme_statement}</p>}
                    {t.discriminators?.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Discriminators</p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {t.discriminators.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    {t.proof_points?.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Proof points</p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {t.proof_points.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    {t.ghosting_points?.length > 0 && (
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Ghosting points</p>
                        <ul className="list-disc list-inside text-xs space-y-0.5">
                          {t.ghosting_points.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                    )}
                    <div className="flex justify-end">
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(t.id)}>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>
      {currentPhase === "phase_4_win_themes" && (
        <AdvancePhaseButton solicitationId={solicitationId} currentPhase="phase_4_win_themes" />
      )}
    </div>
  );
}
