import { format } from "date-fns";
import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Sparkles, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useOrgMembers } from "@/features/collaboration/hooks/useOrgMembers";
import { useUpdateOutlineNodeFields, type WritingQueueRow } from "../hooks/useWritingQueue";
import { priorityTone } from "../lib/priority";

const STATUS_LABELS = {
  not_started: "Not started",
  drafting: "Drafting",
  pink_ready: "Pink ready",
  red_ready: "Red ready",
  final: "Final",
} as const;

const STATUS_CLASSES: Record<keyof typeof STATUS_LABELS, string> = {
  not_started: "bg-muted text-muted-foreground",
  drafting: "bg-sky-500/15 text-sky-600 border-sky-500/30",
  pink_ready: "bg-pink-500/15 text-pink-600 border-pink-500/30",
  red_ready: "bg-red-500/15 text-red-600 border-red-500/30",
  final: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
};

export function WritingQueueCard({ row, outlineId }: { row: WritingQueueRow; outlineId: string | undefined }) {
  const [open, setOpen] = useState(false);
  const { data: members = [] } = useOrgMembers();
  const update = useUpdateOutlineNodeFields(outlineId);

  const { node, priority, linkedRequirements, themes, criticalGapCount } = row;
  const tone = priorityTone(priority.total);
  const toneClass =
    tone === "high"
      ? "bg-red-500/15 text-red-600 border-red-500/30"
      : tone === "medium"
        ? "bg-amber-500/15 text-amber-600 border-amber-500/30"
        : "bg-muted text-muted-foreground";

  const assignee = members.find((m) => m.id === node.assigned_to);

  const patch = (p: Parameters<typeof update.mutateAsync>[0]["patch"]) =>
    update.mutateAsync({ id: node.id, patch: p }).catch((e) =>
      toast({ title: "Update failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" }),
    );

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-0.5 text-muted-foreground hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {node.section_number && (
                <span className="font-mono text-xs text-muted-foreground">{node.section_number}</span>
              )}
              {node.volume && <Badge variant="outline" className="text-[10px]">{node.volume}</Badge>}
              <span className="font-medium truncate">{node.title}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mt-1.5 text-xs text-muted-foreground">
              {node.page_allocation ? <Badge variant="secondary">{node.page_allocation}p</Badge> : null}
              {linkedRequirements.length > 0 && (
                <Badge variant="outline">{linkedRequirements.length} reqs</Badge>
              )}
              {themes.length > 0 && (
                <Badge variant="outline" className="border-primary/40 text-primary">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {themes.length} theme{themes.length === 1 ? "" : "s"}
                </Badge>
              )}
              {criticalGapCount > 0 && (
                <Badge variant="outline" className="border-destructive/40 text-destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {criticalGapCount} critical gap{criticalGapCount === 1 ? "" : "s"}
                </Badge>
              )}
              {node.source_l_reference && <span>→ {node.source_l_reference}</span>}
            </div>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={cn("font-mono", toneClass)}>
                {priority.total}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="font-medium mb-1">Priority breakdown</p>
              <ul className="text-xs space-y-0.5">
                {priority.parts.length === 0 && <li className="text-muted-foreground">No score factors yet.</li>}
                {priority.parts.map((p) => (
                  <li key={p.label} className="flex justify-between gap-4">
                    <span>{p.label}</span>
                    <span className="font-mono">{p.value > 0 ? `+${p.value}` : p.value}</span>
                  </li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2 flex-wrap pl-7">
          {/* Owner */}
          <Select
            value={node.assigned_to ?? "__unassigned"}
            onValueChange={(v) => patch({ assigned_to: v === "__unassigned" ? null : v })}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <User className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Unassigned">
                {assignee ? (assignee.full_name ?? assignee.email) : "Unassigned"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__unassigned">Unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name ?? m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select
            value={node.writing_status ?? "not_started"}
            onValueChange={(v) => patch({ writing_status: v as keyof typeof STATUS_LABELS })}
          >
            <SelectTrigger className={cn("h-8 w-[140px] text-xs border", STATUS_CLASSES[(node.writing_status ?? "not_started") as keyof typeof STATUS_LABELS])}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {STATUS_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Due date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                {node.due_date ? format(new Date(node.due_date), "MMM d") : "Set due date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={node.due_date ? new Date(node.due_date) : undefined}
                onSelect={(d) => patch({ due_date: d ? d.toISOString().slice(0, 10) : null })}
                initialFocus
              />
              {node.due_date && (
                <div className="p-2 border-t">
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => patch({ due_date: null })}>
                    Clear
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        {open && (
          <div className="pl-7 space-y-3 pt-2 border-t">
            {linkedRequirements.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Linked requirements</p>
                <ul className="space-y-1 text-xs">
                  {linkedRequirements.map((r) => (
                    <li key={r.id} className="flex gap-2">
                      <span className="font-mono text-muted-foreground shrink-0">{r.req_number}</span>
                      <span className="line-clamp-2">{r.shall_text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {themes.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1.5">Win themes mapped here</p>
                <ul className="space-y-1 text-xs">
                  {themes.map((t) => (
                    <li key={t.id}>
                      <span className="font-medium">{t.title}</span>
                      {t.theme_statement && (
                        <span className="text-muted-foreground"> — {t.theme_statement}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {node.notes && (
              <div>
                <p className="text-xs font-medium mb-1">Notes</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{node.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
