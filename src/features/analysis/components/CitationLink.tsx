import { Copy, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { formatCitation } from "../utils/citationParser";

interface CitationLinkProps {
  document?: string;
  section?: string;
  page?: number | null;
  quote?: string;
  onOpen?: () => void;
}

export function CitationLink({ document, section, page, quote, onOpen }: CitationLinkProps) {
  if (!document && !section && page == null) return null;
  const label = formatCitation({ document, section, page });
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(label);
    toast({ title: "Citation copied" });
  };
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline group"
          >
            <FileText className="h-3 w-3" />
            <span className="truncate max-w-[40ch]">{label}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-4 w-4 opacity-0 group-hover:opacity-100"
              onClick={handleCopy}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </button>
        </TooltipTrigger>
        {quote ? (
          <TooltipContent className="max-w-sm">
            <p className="text-xs italic">"{quote}"</p>
          </TooltipContent>
        ) : null}
      </Tooltip>
    </TooltipProvider>
  );
}
