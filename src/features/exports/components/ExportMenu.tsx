import { useState } from "react";
import { Download, FileText, FileType2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { exportDocument, type ExportDocument, type ExportFormat } from "@/features/exports/lib/exporters";

interface Props {
  /** Lazy builder so we only assemble the doc on click */
  build: () => ExportDocument | null;
  disabled?: boolean;
  label?: string;
}

export function ExportMenu({ build, disabled, label = "Export" }: Props) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat) => {
    const doc = build();
    if (!doc) {
      toast({ title: "Nothing to export", description: "Generate the content first.", variant: "destructive" });
      return;
    }
    try {
      setBusy(format);
      await exportDocument(doc, format);
      toast({ title: "Export ready", description: `${format.toUpperCase()} downloaded.` });
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !!busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run("pdf")} disabled={!!busy}>
          <FileText className="h-4 w-4 mr-2" /> Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("docx")} disabled={!!busy}>
          <FileType2 className="h-4 w-4 mr-2" /> Export as Word (.docx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
