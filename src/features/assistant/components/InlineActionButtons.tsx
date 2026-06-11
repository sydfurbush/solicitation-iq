import { useState } from "react";
import { Check, AlertTriangle, Lightbulb, ListChecks, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export type SuggestedAction = {
  action: "create_risk" | "create_opportunity" | "create_requirement";
  title: string;
  description?: string;
  severity?: "low" | "medium" | "high" | "critical";
};

type Props = {
  messageId: string;
  solicitationId: string;
  citations: any[];
};

const STORAGE_KEY = "assistant_applied_actions_v1";

function loadApplied(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveApplied(state: Record<string, string[]>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function actionKey(a: SuggestedAction, i: number) {
  return `${i}:${a.action}:${a.title}`;
}

function iconFor(kind: SuggestedAction["action"]) {
  if (kind === "create_risk") return <AlertTriangle className="h-3 w-3" />;
  if (kind === "create_opportunity") return <Lightbulb className="h-3 w-3" />;
  return <ListChecks className="h-3 w-3" />;
}

function ctaFor(kind: SuggestedAction["action"]) {
  if (kind === "create_risk") return "Create risk";
  if (kind === "create_opportunity") return "Create opportunity";
  return "Add requirement";
}

export function InlineActionButtons({ messageId, solicitationId, citations }: Props) {
  const qc = useQueryClient();
  const actions: SuggestedAction[] = (citations ?? [])
    .filter((c: any) => c?.kind === "suggested_action" && c?.action && c?.title)
    .map((c: any) => ({
      action: c.action,
      title: String(c.title),
      description: c.description ? String(c.description) : undefined,
      severity: c.severity,
    }));

  const [applied, setApplied] = useState<Record<string, string[]>>(() => loadApplied());
  const [pending, setPending] = useState<string | null>(null);
  const appliedKeys = new Set(applied[messageId] ?? []);

  if (actions.length === 0) return null;

  const markApplied = (key: string) => {
    setApplied((prev) => {
      const next = { ...prev, [messageId]: Array.from(new Set([...(prev[messageId] ?? []), key])) };
      saveApplied(next);
      return next;
    });
  };

  const apply = async (a: SuggestedAction, key: string) => {
    setPending(key);
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;
      if (a.action === "create_risk") {
        const { error } = await supabase.from("risks").insert({
          solicitation_id: solicitationId,
          title: a.title,
          description: a.description ?? a.title,
          severity: (a.severity ?? "medium") as any,
          is_ai_generated: true,
          created_by: userId,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["risks", solicitationId] });
        toast({ title: "Risk created", description: a.title });
      } else if (a.action === "create_opportunity") {
        const { error } = await supabase.from("opportunities").insert({
          solicitation_id: solicitationId,
          title: a.title,
          description: a.description ?? a.title,
          opportunity_type: "differentiation",
          is_ai_generated: true,
          created_by: userId,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["opportunities", solicitationId] });
        toast({ title: "Opportunity created", description: a.title });
      } else {
        // create_requirement: schema uses req_number + shall_text
        const reqNumber = `AI-${Date.now().toString(36).slice(-4).toUpperCase()}`;
        const { error } = await supabase.from("requirement_items").insert({
          solicitation_id: solicitationId,
          req_number: reqNumber,
          shall_text: a.description ?? a.title,
          notes: a.title,
          is_ai_generated: true,
          created_by: userId,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["requirement_items", solicitationId] });
        toast({ title: "Requirement added", description: `${reqNumber} · ${a.title}` });
      }
      markApplied(key);
    } catch (e: any) {
      toast({
        title: "Couldn't apply suggestion",
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="not-prose mt-3 flex flex-wrap gap-1.5">
      {actions.map((a, i) => {
        const key = actionKey(a, i);
        const isApplied = appliedKeys.has(key);
        const isPending = pending === key;
        return (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={isApplied ? "secondary" : "outline"}
            className="h-7 px-2 text-xs gap-1.5"
            disabled={isApplied || isPending}
            onClick={() => apply(a, key)}
            title={a.description || a.title}
          >
            {isApplied ? (
              <Check className="h-3 w-3" />
            ) : isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Plus className="h-3 w-3" />
                {iconFor(a.action)}
              </>
            )}
            <span className="truncate max-w-[240px]">
              {isApplied ? "Added" : ctaFor(a.action)}: {a.title}
            </span>
          </Button>
        );
      })}
    </div>
  );
}
