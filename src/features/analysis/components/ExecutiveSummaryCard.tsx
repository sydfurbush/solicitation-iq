import { useState } from "react";
import { Copy, Pencil, Save, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useUpdateExecutiveSummary } from "../hooks/useAnalysis";

interface Props {
  solicitationId: string;
  summary: string | null;
}

export function ExecutiveSummaryCard({ solicitationId, summary }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary ?? "");
  const [expanded, setExpanded] = useState(false);
  const update = useUpdateExecutiveSummary(solicitationId);

  const handleCopy = () => {
    navigator.clipboard.writeText(summary ?? "");
    toast({ title: "Summary copied" });
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync(draft);
      toast({ title: "Summary updated" });
      setEditing(false);
    } catch (e) {
      toast({ title: "Failed to save", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const text = summary ?? "";
  const isLong = text.length > 600;
  const display = expanded || !isLong ? text : `${text.slice(0, 600)}…`;

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          Executive summary
        </CardTitle>
        <div className="flex gap-1">
          {!editing ? (
            <>
              <Button variant="ghost" size="sm" onClick={handleCopy} disabled={!text}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setDraft(text); setEditing(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={update.isPending}>
                <Save className="h-4 w-4 mr-1" /> Save
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            className="font-mono text-sm"
          />
        ) : text ? (
          <>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{display}</p>
            {isLong && (
              <Button variant="link" size="sm" className="px-0 mt-2" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : "Show more"}
              </Button>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground italic">No summary available yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
