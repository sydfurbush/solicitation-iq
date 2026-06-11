import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, AlertTriangle, Sparkles, ListChecks, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { usePinnedEntities } from "../hooks/usePinnedEntities";
import type { AssistantThread, PinnedEntityKind } from "../hooks/useAssistantThreads";

type Props = { thread: AssistantThread | null; solicitationId: string };

type Item = { id: string; label: string; sublabel?: string };

const KIND_META: Record<PinnedEntityKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  risk: { label: "Risks", icon: AlertTriangle },
  opportunity: { label: "Opps", icon: Sparkles },
  requirement: { label: "Reqs", icon: ListChecks },
  document: { label: "Docs", icon: FileText },
};

function useFocusOptions(solicitationId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["assistant_focus_options", solicitationId],
    enabled: enabled && !!solicitationId,
    staleTime: 60_000,
    queryFn: async () => {
      const [risks, opps, reqs, docs] = await Promise.all([
        supabase
          .from("risks")
          .select("id,title,severity")
          .eq("solicitation_id", solicitationId)
          .order("severity", { ascending: false })
          .limit(50),
        supabase
          .from("opportunities")
          .select("id,title,impact_score")
          .eq("solicitation_id", solicitationId)
          .order("impact_score", { ascending: false, nullsFirst: false })
          .limit(50),
        supabase
          .from("requirement_items")
          .select("id,title,is_critical")
          .eq("solicitation_id", solicitationId)
          .order("is_critical", { ascending: false })
          .limit(80),
        supabase
          .from("documents")
          .select("id,file_name,document_type")
          .eq("solicitation_id", solicitationId)
          .is("deleted_at", null)
          .limit(40),
      ]);
      return {
        risk: ((risks.data ?? []) as any[]).map<Item>((r) => ({
          id: r.id,
          label: r.title ?? "Untitled risk",
          sublabel: r.severity ?? undefined,
        })),
        opportunity: ((opps.data ?? []) as any[]).map<Item>((o) => ({
          id: o.id,
          label: o.title ?? "Untitled opportunity",
          sublabel: o.impact_score ? `impact ${o.impact_score}` : undefined,
        })),
        requirement: ((reqs.data ?? []) as any[]).map<Item>((r) => ({
          id: r.id,
          label: r.title ?? "Untitled requirement",
          sublabel: r.is_critical ? "critical" : undefined,
        })),
        document: ((docs.data ?? []) as any[]).map<Item>((d) => ({
          id: d.id,
          label: d.file_name ?? "Document",
          sublabel: d.document_type ?? undefined,
        })),
      } as Record<PinnedEntityKind, Item[]>;
    },
  });
}

export function PinEntityPopover({ thread, solicitationId }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PinnedEntityKind>("risk");
  const [q, setQ] = useState("");
  const { entities, add, isPinned, atLimit, limit } = usePinnedEntities(thread);
  const { data, isLoading } = useFocusOptions(solicitationId, open);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px] gap-1"
          disabled={!thread}
          title={atLimit ? `Up to ${limit} focus items` : "Pin a focus item"}
        >
          <Plus className="h-3 w-3" />
          Focus
          {entities.length > 0 && (
            <span className="text-muted-foreground">({entities.length}/{limit})</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        <div className="p-2 border-b">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="h-7 text-xs"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as PinnedEntityKind)}>
          <TabsList className="grid grid-cols-4 mx-2 mt-2 h-8">
            {(Object.keys(KIND_META) as PinnedEntityKind[]).map((k) => {
              const Icon = KIND_META[k].icon;
              return (
                <TabsTrigger key={k} value={k} className="text-[11px] gap-1">
                  <Icon className="h-3 w-3" />
                  {KIND_META[k].label}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {(Object.keys(KIND_META) as PinnedEntityKind[]).map((k) => {
            const items = (data?.[k] ?? []).filter((i) =>
              !q.trim() ? true : i.label.toLowerCase().includes(q.toLowerCase()),
            );
            return (
              <TabsContent key={k} value={k} className="m-0 max-h-[320px] overflow-y-auto">
                {isLoading ? (
                  <div className="p-3 text-xs text-muted-foreground">Loading…</div>
                ) : items.length === 0 ? (
                  <div className="p-3 text-xs text-muted-foreground">Nothing to pin.</div>
                ) : (
                  <ul className="py-1">
                    {items.map((it) => {
                      const pinned = isPinned(k, it.id);
                      const disabled = !pinned && atLimit;
                      return (
                        <li key={it.id}>
                          <button
                            type="button"
                            disabled={disabled || pinned}
                            onClick={() =>
                              add({ kind: k, id: it.id, label: it.label.slice(0, 100) })
                            }
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-60 flex items-center gap-2"
                            title={pinned ? "Already pinned" : disabled ? `Limit ${limit}` : "Pin"}
                          >
                            <span className="flex-1 truncate">{it.label}</span>
                            {it.sublabel && (
                              <span className="text-[10px] text-muted-foreground">{it.sublabel}</span>
                            )}
                            {pinned && <Check className="h-3 w-3 text-primary" />}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
