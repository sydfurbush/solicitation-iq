import { Download, Copy, FileText, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { copyRich, copyPlain } from "../lib/copyRich";
import {
  buildTranscriptMarkdown,
  downloadMarkdown,
  slugify,
} from "../lib/exportTranscript";
import type { AssistantMessage, AssistantThread } from "../hooks/useAssistantThreads";

type Props = {
  thread: AssistantThread | null;
  messages: AssistantMessage[];
};

export function ExportThreadButton({ thread, messages }: Props) {
  const disabled = !thread || messages.length === 0;

  const doCopyRich = async () => {
    if (!thread) return;
    const md = buildTranscriptMarkdown(thread, messages);
    try {
      await copyRich(md);
      toast({ title: "Copied", description: "Transcript copied as rich text." });
    } catch (e: any) {
      toast({ title: "Copy failed", description: e?.message ?? "Could not copy", variant: "destructive" });
    }
  };
  const doCopyPlain = async () => {
    if (!thread) return;
    const md = buildTranscriptMarkdown(thread, messages);
    try {
      await copyPlain(md);
      toast({ title: "Copied", description: "Transcript copied as markdown." });
    } catch (e: any) {
      toast({ title: "Copy failed", description: e?.message ?? "Could not copy", variant: "destructive" });
    }
  };
  const doDownload = () => {
    if (!thread) return;
    const md = buildTranscriptMarkdown(thread, messages);
    downloadMarkdown(`assistant-thread-${slugify(thread.title)}.md`, md);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs gap-1.5"
          disabled={disabled}
          title="Export this conversation"
        >
          <Download className="h-3.5 w-3.5" />
          Export
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={doCopyRich}>
          <Copy className="h-3.5 w-3.5 mr-2" />
          Copy as rich text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={doCopyPlain}>
          <Copy className="h-3.5 w-3.5 mr-2" />
          Copy as markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={doDownload}>
          <FileText className="h-3.5 w-3.5 mr-2" />
          Download .md
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
