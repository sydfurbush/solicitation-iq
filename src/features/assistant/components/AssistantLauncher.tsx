import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ThreadList } from "./ThreadList";
import { AssistantChat } from "./AssistantChat";
import { useAssistantThreads, useCreateThread } from "../hooks/useAssistantThreads";

export function AssistantLauncher({ solicitationId }: { solicitationId: string }) {
  const [open, setOpen] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const { data: threads = [] } = useAssistantThreads(solicitationId);
  const create = useCreateThread();

  useEffect(() => {
    if (!open || threadId) return;
    if (threads.length > 0) {
      setThreadId(threads[0].id);
    } else if (!create.isPending) {
      create.mutateAsync({ solicitationId }).then((t) => setThreadId(t.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, threads.length]);

  return (
    <>
      <Button
        size="icon"
        className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg"
        onClick={() => setOpen(true)}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-5 w-5" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-[640px] p-0 flex flex-col">
          <div className="grid grid-cols-[220px_1fr] flex-1 min-h-0">
            <div className="border-r bg-muted/30 min-h-0">
              <ThreadList
                solicitationId={solicitationId}
                activeThreadId={threadId}
                onSelect={setThreadId}
              />
            </div>
            <div className="min-h-0">
              {threadId ? (
                <AssistantChat key={threadId} solicitationId={solicitationId} threadId={threadId} compact />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                  Starting a new conversation…
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
