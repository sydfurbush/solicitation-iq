import { useState } from "react";
import { Download, FileText, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useClientsList } from "@/features/reports-hub/hooks/useReportsHub";
import { generatePastPerformancePdf } from "@/features/reports/pdf/pastPerformance";
import {
  downloadWinLossPdf,
  type WinLossPayload,
} from "@/features/reports/pdf/winLossAnalysis";

export function OrgReportsTab() {
  const { data: clients = [] } = useClientsList();
  const [clientId, setClientId] = useState<string>("all");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [pastPerfLoading, setPastPerfLoading] = useState(false);
  const [winLossLoading, setWinLossLoading] = useState(false);

  const onPastPerf = async () => {
    setPastPerfLoading(true);
    try {
      await generatePastPerformancePdf({ clientId: clientId === "all" ? null : clientId });
      toast({ title: "Past performance brief downloaded" });
    } catch (e) {
      toast({
        title: "Could not generate brief",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setPastPerfLoading(false);
    }
  };

  const onWinLoss = async () => {
    setWinLossLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<WinLossPayload>(
        "generate-win-loss-analysis",
        {
          body: {
            clientId: clientId === "all" ? null : clientId,
            from: from || null,
            to: to || null,
          },
        }
      );
      if (error) throw error;
      if (!data) throw new Error("Empty response");
      const clientName = clientId === "all" ? undefined : clients.find((c) => c.id === clientId)?.name;
      downloadWinLossPdf(data, { from, to, clientName });
      toast({ title: "Win/loss analysis downloaded" });
    } catch (e) {
      toast({
        title: "Could not generate analysis",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setWinLossLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Past Performance Brief
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Reusable past-performance reference built from every recorded win. Filter by client if you only
              need a subset.
            </p>
            <Button onClick={onPastPerf} disabled={pastPerfLoading} className="gap-1.5" size="sm">
              {pastPerfLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {pastPerfLoading ? "Generating…" : "Download brief"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Win / Loss Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              AI-generated narrative themes for wins, losses, and no-bids over the selected period, with
              actionable recommendations.
            </p>
            <Button onClick={onWinLoss} disabled={winLossLoading} className="gap-1.5" size="sm">
              {winLossLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              {winLossLoading ? "Analyzing…" : "Generate analysis"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
