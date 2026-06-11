import { useState } from "react";
import { Download, Copy, FileText, FileDown, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import {
  copyFormatted,
  downloadAssistantPdf,
  downloadAssistantDocx,
} from "../lib/exportFormatted";
import type { AssistantMessage, AssistantThread } from "../hooks/useAssistantThreads";

type Props = {
  thread: AssistantThread | null;
  messages: AssistantMessage[];
};

export function ExportThreadButton({ thread, messages }: Props) {
  const disabled = !thread || messages.length === 0;
  const [busy, setBusy] = useState<null | "copy" | "pdf" | "docx">(null);

  const run = async (kind: "copy" | "pdf" | "docx", fn: () => Promise<void>, okMsg?: string) => {
    if (!thread) return;
    setBusy(kind);
    try {
      await fn();
      if (okMsg) toast({ title: okMsg });
    } catch (e: any) {
      toast({
        title: "Export failed",
        description: e?.message ?? "Could not export the conversation",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs gap-1.5"
          disabled={disabled || !!busy}
          title="Export this conversation"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          Export
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() =>
            run("copy", () => copyFormatted(thread!, messages), "Copied formatted transcript")
          }
        >
          <Copy className="h-3.5 w-3.5 mr-2" />
          Copy formatted
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => run("docx", () => downloadAssistantDocx(thread!, messages))}
        >
          <FileText className="h-3.5 w-3.5 mr-2" />
          Download Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => run("pdf", () => downloadAssistantPdf(thread!, messages))}
        >
          <FileDown className="h-3.5 w-3.5 mr-2" />
          Download PDF (.pdf)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
