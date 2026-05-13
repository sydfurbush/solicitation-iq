import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ComparisonDiffViewer } from "./ComparisonDiffViewer";
import { DiffHeatmap } from "./DiffHeatmap";
import { useSectionDiff } from "../hooks/useSectionDiff";
import type { SectionPair } from "../utils/sectionMatcher";

type Props = {
  open: boolean;
  onClose: () => void;
  docAId: string | null;
  docBId: string | null;
  fileNameA?: string;
  fileNameB?: string;
};

export function DocumentDiffModal({ open, onClose, docAId, docBId, fileNameA, fileNameB }: Props) {
  const [mode, setMode] = useState<"side-by-side" | "stacked" | "inline">("side-by-side");
  const [granularity, setGranularity] = useState<"words" | "lines">("words");
  const [onlyChanges, setOnlyChanges] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const { data: pairs, isLoading } = useSectionDiff(docAId, docBId);

  const changedPairs = (pairs ?? []).filter((p) => p.status !== "unchanged");
  const visiblePairs = onlyChanges ? changedPairs : (pairs ?? []);
  const active: SectionPair | undefined = visiblePairs[activeIdx];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle className="text-base">
            <span className="text-muted-foreground line-through">{fileNameA ?? "Prior"}</span>
            <span className="mx-2">→</span>
            <span>{fileNameB ?? "Current"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 flex-wrap pb-2 border-b">
          <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as typeof mode)} size="sm">
            <ToggleGroupItem value="side-by-side" className="text-xs">Side-by-side</ToggleGroupItem>
            <ToggleGroupItem value="stacked" className="text-xs">Stacked</ToggleGroupItem>
            <ToggleGroupItem value="inline" className="text-xs">Inline</ToggleGroupItem>
          </ToggleGroup>
          <ToggleGroup type="single" value={granularity} onValueChange={(v) => v && setGranularity(v as typeof granularity)} size="sm">
            <ToggleGroupItem value="words" className="text-xs">Words</ToggleGroupItem>
            <ToggleGroupItem value="lines" className="text-xs">Lines</ToggleGroupItem>
          </ToggleGroup>
          <div className="flex items-center gap-2">
            <Switch id="only-changes" checked={onlyChanges} onCheckedChange={setOnlyChanges} />
            <Label htmlFor="only-changes" className="text-xs">Only sections with changes</Label>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">Use <kbd className="px-1 border rounded">j</kbd>/<kbd className="px-1 border rounded">k</kbd> to nav</span>
        </div>

        {isLoading ? (
          <Skeleton className="h-[60vh] w-full" />
        ) : !pairs || pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No parsed sections to compare.</p>
        ) : (
          <div className="grid grid-cols-[180px_12px_1fr] gap-3 max-h-[70vh]">
            {/* TOC */}
            <ScrollArea className="border rounded-md">
              <ul className="p-1">
                {visiblePairs.map((p, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setActiveIdx(i)}
                      className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted ${i === activeIdx ? "bg-muted font-medium" : ""}`}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <Badge variant="outline" className="text-[9px] py-0 px-1 capitalize">{p.status}</Badge>
                        {p.status === "modified" && (
                          <span className="text-[10px] text-muted-foreground">{Math.round(p.density * 100)}%</span>
                        )}
                      </div>
                      <span className="line-clamp-2">
                        {p.b?.section_number ?? p.a?.section_number} {p.b?.section_title ?? p.a?.section_title ?? "(untitled)"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </ScrollArea>

            <DiffHeatmap pairs={visiblePairs} onJump={setActiveIdx} className="h-full" />

            <div className="overflow-hidden">
              {active ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {active.b?.section_number ?? active.a?.section_number}{" "}
                      {active.b?.section_title ?? active.a?.section_title ?? "(untitled)"}
                    </p>
                    <Badge variant="outline" className="capitalize">{active.status}</Badge>
                  </div>
                  <ComparisonDiffViewer
                    oldText={active.a?.content ?? ""}
                    newText={active.b?.content ?? ""}
                    mode={mode}
                    granularity={granularity}
                    onlyChanges={false}
                    enableKeyboardNav
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Select a section.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
