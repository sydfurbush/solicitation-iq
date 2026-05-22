import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDocuments, type DocumentRow } from "./useDocuments";

export type DocumentsReadiness = {
  total: number;
  analyzed: number;
  failed: number;
  processing: number;
  stalled: number;
  stalledDocs: DocumentRow[];
  allReady: boolean;
  hasFailures: boolean;
  hasStalled: boolean;
  documents: DocumentRow[];
};

// A doc is "stalled" if it has been at status=parsed for more than this long
// without advancing to analyzed (the extract-entities handoff failed).
const STALL_THRESHOLD_MS = 2 * 60 * 1000;

/**
 * Watches a solicitation's documents in realtime and computes readiness.
 * Calls `onBecameReady` exactly once per transition from "not all analyzed"
 * to "all analyzed (and zero failures)".
 */
export function useDocumentsReadiness(
  solicitationId: string | undefined,
  onBecameReady?: (r: DocumentsReadiness) => void,
): DocumentsReadiness {
  const qc = useQueryClient();
  const { data: documents = [] } = useDocuments(solicitationId);

  // Realtime: invalidate the documents query whenever a doc row changes for this solicitation.
  // Channel name must be unique per hook instance — multiple components may mount this hook
  // for the same solicitation, and reusing a name re-subscribes to an already-open channel.
  useEffect(() => {
    if (!solicitationId) return;
    const channelName = `docs-readiness-${solicitationId}-${Math.random().toString(36).slice(2, 10)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "documents",
          filter: `solicitation_id=eq.${solicitationId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["documents", solicitationId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [solicitationId, qc]);

  const readiness = useMemo<DocumentsReadiness>(() => {
    const total = documents.length;
    const analyzed = documents.filter((d) => d.status === "analyzed").length;
    const failed = documents.filter((d) => d.status === "failed").length;
    const now = Date.now();
    const stalledDocs = documents.filter((d) => {
      if (d.status !== "parsed") return false;
      const completed = d.processing_completed_at
        ? new Date(d.processing_completed_at).getTime()
        : null;
      return completed != null && now - completed > STALL_THRESHOLD_MS;
    });
    const stalled = stalledDocs.length;
    const processing = total - analyzed - failed - stalled;
    const hasFailures = failed > 0;
    const hasStalled = stalled > 0;
    const allReady = total > 0 && analyzed === total;
    return {
      total,
      analyzed,
      failed,
      processing,
      stalled,
      stalledDocs,
      allReady,
      hasFailures,
      hasStalled,
      documents,
    };
  }, [documents]);

  // Transition detector — fires once when allReady flips false → true with no failures.
  // Skips the initial mount so already-complete states don't re-fire.
  const prevAllReadyRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!solicitationId) return;
    if (readiness.total === 0) {
      prevAllReadyRef.current = null;
      return;
    }
    const prev = prevAllReadyRef.current;
    if (prev === null) {
      prevAllReadyRef.current = readiness.allReady;
      return;
    }
    if (!prev && readiness.allReady && !readiness.hasFailures) {
      onBecameReady?.(readiness);
    }
    prevAllReadyRef.current = readiness.allReady;
  }, [readiness, solicitationId, onBecameReady]);

  return readiness;
}
