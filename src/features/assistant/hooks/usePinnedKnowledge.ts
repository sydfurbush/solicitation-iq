import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads/writes `assistant_threads.pinned_knowledge_ids` (uuid[]).
 * The thread row (with the array) is already fetched by `useAssistantThreads`,
 * so this hook only exposes mutators; callers pass in the current array.
 */
export function usePinnedKnowledge(threadId: string | undefined, solicitationId: string | undefined) {
  const qc = useQueryClient();

  const save = async (ids: string[]) => {
    if (!threadId) throw new Error("threadId required");
    const unique = Array.from(new Set(ids));
    const { error } = await supabase
      .from("assistant_threads")
      .update({ pinned_knowledge_ids: unique })
      .eq("id", threadId);
    if (error) throw error;
    return unique;
  };

  const invalidate = () => {
    if (solicitationId) qc.invalidateQueries({ queryKey: ["assistant_threads", solicitationId] });
  };

  const setMutation = useMutation({
    mutationFn: save,
    onSuccess: invalidate,
  });

  return {
    setAll: (ids: string[]) => setMutation.mutateAsync(ids),
    pin: (current: string[], id: string) =>
      setMutation.mutateAsync(current.includes(id) ? current : [...current, id]),
    unpin: (current: string[], id: string) =>
      setMutation.mutateAsync(current.filter((x) => x !== id)),
    clear: () => setMutation.mutateAsync([]),
    isPending: setMutation.isPending,
  };
}
