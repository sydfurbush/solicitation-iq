import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { ThreadList } from "@/features/assistant/components/ThreadList";
import { AssistantChat } from "@/features/assistant/components/AssistantChat";
import { useAssistantThreads, useCreateThread } from "@/features/assistant/hooks/useAssistantThreads";

export default function SolicitationAssistant({ solicitationId }: { solicitationId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get("thread");
  const { data: threads = [], isLoading } = useAssistantThreads(solicitationId);
  const create = useCreateThread();

  const setThread = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "assistant");
    next.set("thread", id);
    setSearchParams(next);
  };

  // Auto-select first thread (or create one) when none selected
  useEffect(() => {
    if (threadId || isLoading) return;
    if (threads.length > 0) {
      setThread(threads[0].id);
    } else if (!create.isPending) {
      create.mutateAsync({ solicitationId }).then((t) => setThread(t.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, threads, isLoading]);

  const activeThread = useMemo(
    () => (threadId ? threads.find((t) => t.id === threadId) : null) ?? null,
    [threadId, threads],
  );

  return (
    <div className="grid grid-cols-[260px_1fr] overflow-hidden h-full min-h-0 bg-card">
      <div className="border-r bg-muted/30 min-h-0">
        <ThreadList solicitationId={solicitationId} activeThreadId={threadId} onSelect={setThread} />
      </div>
      <div className="min-h-0">
        {threadId && activeThread ? (
          <AssistantChat key={threadId} solicitationId={solicitationId} threadId={threadId} />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Select or start a conversation.
          </div>
        )}
      </div>
    </div>
  );
}
