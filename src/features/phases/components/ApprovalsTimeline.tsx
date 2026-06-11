import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Send, Check, AlertCircle, RotateCcw, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { PhaseType } from "@/lib/validators/solicitation";

const PHASE_LABELS: Record<string, string> = {
  phase_1_initial: "Initial",
  phase_2_deep_dive: "Deep Dive",
  phase_3_outline: "Proposal Development",
};

interface ApprovalEvent {
  id: string;
  user_id: string | null;
  event_type: string;
  event_description: string;
  created_at: string;
  metadata: { phase?: PhaseType; status?: string; note?: string | null } | null;
}

const STATUS_META: Record<
  string,
  { label: string; icon: typeof Send; tone: string }
> = {
  pending_review: { label: "Requested review", icon: Send, tone: "text-amber-600" },
  approved: { label: "Approved", icon: Check, tone: "text-emerald-600" },
  changes_requested: { label: "Requested changes", icon: AlertCircle, tone: "text-rose-600" },
  not_ready: { label: "Reset", icon: RotateCcw, tone: "text-muted-foreground" },
};

export function ApprovalsTimeline({ solicitationId }: { solicitationId: string | undefined }) {
  const qc = useQueryClient();

  const eventsQuery = useQuery({
    queryKey: ["approval-timeline", solicitationId],
    enabled: !!solicitationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_log")
        .select("id, user_id, event_type, event_description, created_at, metadata")
        .eq("solicitation_id", solicitationId!)
        .like("event_type", "phase_approval_%")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as ApprovalEvent[];
    },
  });

  useEffect(() => {
    if (!solicitationId) return;
    const channel = supabase
      .channel(`approval-timeline-${solicitationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "activity_log", filter: `solicitation_id=eq.${solicitationId}` },
        (payload) => {
          const t = (payload.new as { event_type?: string })?.event_type ?? "";
          if (t.startsWith("phase_approval_")) {
            qc.invalidateQueries({ queryKey: ["approval-timeline", solicitationId] });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [solicitationId, qc]);

  const events = eventsQuery.data ?? [];
  const userIds = useMemo(
    () => Array.from(new Set(events.map((e) => e.user_id).filter(Boolean) as string[])),
    [events],
  );

  const namesQuery = useQuery({
    queryKey: ["approval-timeline-names", solicitationId, userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const map: Record<string, string> = {};
      const [{ data: staff }, { data: clientPpl }] = await Promise.all([
        supabase.from("users").select("id, full_name, email").in("id", userIds),
        supabase.from("client_users").select("id, full_name, email").in("id", userIds),
      ]);
      for (const u of staff ?? []) map[u.id] = u.full_name || u.email || "Staff user";
      for (const u of clientPpl ?? []) map[u.id] = (u.full_name || u.email || "Client user") + " (client)";
      return map;
    },
  });
  const nameMap = namesQuery.data ?? {};

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Approvals timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {eventsQuery.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No approval activity yet.</p>
        ) : (
          <ol className="relative border-l border-border pl-5 space-y-4">
            {events.map((e) => {
              const status = e.metadata?.status ?? e.event_type.replace("phase_approval_", "");
              const meta = STATUS_META[status] ?? STATUS_META.not_ready;
              const Icon = meta.icon;
              const phase = e.metadata?.phase;
              const phaseLabel = phase ? PHASE_LABELS[phase] ?? phase : null;
              const actor = e.user_id ? nameMap[e.user_id] ?? "Unknown user" : "System";
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border">
                    <Icon className={`h-3 w-3 ${meta.tone}`} />
                  </span>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium">{meta.label}</span>
                    {phaseLabel && (
                      <Badge variant="outline" className="text-xs">{phaseLabel}</Badge>
                    )}
                    <span className="text-muted-foreground">by {actor}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Clock className="h-3 w-3" />
                    {format(new Date(e.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </div>
                  {e.metadata?.note && (
                    <p className="text-sm mt-1 p-2 rounded bg-muted/50 whitespace-pre-wrap">
                      {e.metadata.note}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
