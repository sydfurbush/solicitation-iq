import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ThreadList } from "@/features/assistant/components/ThreadList";
import { AssistantChat } from "@/features/assistant/components/AssistantChat";
import { useAssistantThreads, useCreateThread } from "@/features/assistant/hooks/useAssistantThreads";

export default function SolicitationAssistant({ solicitationId }: { solicitationId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const threadId = searchParams.get("thread");
  const { data: threads = [], isLoading } = useAssistantThreads(solicitationId);
  const create = useCreateThread();

  const [memoryOpen, setMemoryOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  const setThread = (id: string, messageId?: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "assistant");
    next.set("thread", id);
    if (messageId) next.set("msg", messageId);
    else next.delete("msg");
    setSearchParams(next);
  };

  // Auto-select first non-deleted thread (or create one) when none selected
  useEffect(() => {
    if (threadId || isLoading) return;
    const live = threads.filter((t) => !t.deleted_at);
    if (live.length > 0) {
      setThread(live[0].id);
    } else if (!create.isPending) {
      create.mutateAsync({ solicitationId }).then((t) => setThread(t.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId, threads, isLoading]);

  const activeThread = useMemo(
    () => (threadId ? threads.find((t) => t.id === threadId) : null) ?? null,
    [threadId, threads],
  );

  const pinnedKnowledgeCount = activeThread?.pinned_knowledge_ids?.length ?? 0;

  return (
    <div className="grid grid-cols-[260px_1fr] overflow-hidden h-full min-h-0 bg-card">
      <div className="border-r bg-muted/30 min-h-0">
        <ThreadList
          solicitationId={solicitationId}
          activeThreadId={threadId}
          onSelect={setThread}
          onOpenKnowledge={() => setKnowledgeOpen(true)}
          onOpenMemory={() => setMemoryOpen(true)}
          onOpenPreferences={() => setPrefsOpen(true)}
          pinnedKnowledgeCount={pinnedKnowledgeCount}
        />
      </div>
      <div className="min-h-0">
        {threadId && activeThread ? (
          <AssistantChat
            key={threadId}
            solicitationId={solicitationId}
            threadId={threadId}
            memoryOpen={memoryOpen}
            onMemoryOpenChange={setMemoryOpen}
            prefsOpen={prefsOpen}
            onPrefsOpenChange={setPrefsOpen}
            knowledgeOpen={knowledgeOpen}
            onKnowledgeOpenChange={setKnowledgeOpen}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Select or start a conversation.
          </div>
        )}
      </div>
    </div>
  );
}
