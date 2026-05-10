import { useState } from "react";
import { Plus, Minus, Pencil, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComparisonDiffViewer } from "./ComparisonDiffViewer";
import type { ChangeItem } from "../hooks/usePriorSolicitation";

type Props = { items: ChangeItem[]; title?: string };

export function RequirementsComparison({ items, title = "Requirements changes" }: Props) {
  const [tab, setTab] = useState<"all" | "added" | "removed" | "modified">("all");
  const filtered = tab === "all" ? items : items.filter((i) => i.type === tab);

  const counts = {
    added: items.filter((i) => i.type === "added").length,
    removed: items.filter((i) => i.type === "removed").length,
    modified: items.filter((i) => i.type === "modified").length,
  };

  const handleExport = () => {
    const csv = ["Type,Significance,Citation,Prior Text,Current Text"]
      .concat(items.map((i) => `"${i.type}","${i.significance ?? ""}","${i.citation ?? ""}","${(i.prior_text ?? "").replace(/"/g, '""')}","${(i.text ?? "").replace(/"/g, '""')}"`))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "requirements-changes.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={items.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All ({items.length})</TabsTrigger>
            <TabsTrigger value="added">Added ({counts.added})</TabsTrigger>
            <TabsTrigger value="removed">Removed ({counts.removed})</TabsTrigger>
            <TabsTrigger value="modified">Modified ({counts.modified})</TabsTrigger>
          </TabsList>
          <TabsContent value={tab} className="space-y-3 mt-4">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No changes in this category.</p>
            ) : (
              filtered.map((item, i) => <ChangeRow key={i} item={item} />)
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ChangeRow({ item }: { item: ChangeItem }) {
  const Icon = item.type === "added" ? Plus : item.type === "removed" ? Minus : Pencil;
  const tone =
    item.type === "added" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
      : item.type === "removed" ? "bg-destructive/10 border-destructive/30 text-destructive"
      : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400";

  return (
    <div className={`rounded-md border p-3 ${tone.split(" ").slice(0, 2).join(" ")}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4" />
        <Badge variant="outline" className="capitalize">{item.type}</Badge>
        {item.significance && <Badge variant="secondary" className="capitalize">{item.significance}</Badge>}
        {item.citation && <span className="text-xs text-muted-foreground ml-auto">{item.citation}</span>}
      </div>
      {item.type === "modified" && item.prior_text ? (
        <ComparisonDiffViewer oldText={item.prior_text} newText={item.text} mode="inline" />
      ) : (
        <p className={`text-sm ${item.type === "removed" ? "line-through opacity-70" : ""}`}>{item.text}</p>
      )}
    </div>
  );
}
