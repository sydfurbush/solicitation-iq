import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, History, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  downloadExportRecord,
  useExportHistory,
  type ExportHistoryRow,
} from "@/features/exports/hooks/useExportHistory";

interface Props {
  solicitationId: string;
  kind: string;
  label?: string;
}

function fmtBytes(n: number | null) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtWhen(s: string) {
  const d = new Date(s);
  return d.toLocaleString();
}

export function ExportHistoryButton({ solicitationId, kind, label = "History" }: Props) {
  const [open, setOpen] = useState(false);
  const { data = [], isLoading, refetch, isFetching } = useExportHistory(solicitationId, kind);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (row: ExportHistoryRow) => {
    try {
      setDownloadingId(row.id);
      await downloadExportRecord(row);
    } catch (e) {
      toast({
        title: "Download failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setOpen(true);
          refetch();
        }}
      >
        <History className="h-4 w-4 mr-2" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Export history</DialogTitle>
            <DialogDescription>
              Previous exports for this section. Click an item to download it again.
            </DialogDescription>
          </DialogHeader>

          {isLoading || isFetching ? (
            <div className="py-8 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
            </div>
          ) : data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No exports yet.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto rounded-md border divide-y">
              {data.map((row) => (
                <div key={row.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{row.filename}</span>
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {row.format}
                      </Badge>
                      {row.version && (
                        <Badge variant="outline" className="text-[10px]">
                          {row.version}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {fmtWhen(row.created_at)} · {fmtBytes(row.file_size)}
                      {row.page_size ? ` · ${row.page_size}` : ""}
                      {row.sections?.length ? ` · ${row.sections.length} section${row.sections.length === 1 ? "" : "s"}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloadingId === row.id}
                    onClick={() => handleDownload(row)}
                  >
                    {downloadingId === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
