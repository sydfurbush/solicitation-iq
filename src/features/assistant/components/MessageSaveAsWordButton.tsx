import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  markdownToDocxBlocks,
  buildPlainDocx,
  saveDocx,
  slugifyFilename,
} from "../lib/docxKit";
import type { AssistantMessage, AssistantThread } from "../hooks/useAssistantThreads";

type Props = {
  message: AssistantMessage;
  thread?: AssistantThread | null;
};

/**
 * Per-message "Save as Word" action — exports a single assistant message
 * as a plain .docx using the shared docxKit (skill-rule guardrails).
 */
export function MessageSaveAsWordButton({ message, thread }: Props) {
  const [busy, setBusy] = useState(false);

  if (message.role !== "assistant") return null;
  const text = (message.parts ?? [])
    .map((p) => (p.type === "text" ? p.text ?? "" : ""))
    .join("\n")
    .trim();
  if (!text) return null;

  const onClick = async () => {
    setBusy(true);
    try {
      const blocks = await markdownToDocxBlocks(text);
      const shortId = message.id.slice(0, 8);
      const title = thread?.title?.trim() || "Assistant message";
      const created = message.created_at ? new Date(message.created_at) : new Date();
      const subtitle = `Saved ${created.toLocaleString()}`;
      const doc = buildPlainDocx({ title, subtitle, blocks, footerText: title });
      const base = thread?.title
        ? `${slugifyFilename(thread.title, "assistant-thread")}-message-${shortId}`
        : `assistant-message-${shortId}`;
      await saveDocx(doc, base);
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ?? "Could not save this message as Word",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-[11px] gap-1.5 text-muted-foreground"
      onClick={onClick}
      disabled={busy}
      title="Save this message as Word (.docx)"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
      Save as Word
    </Button>
  );
}
