import { format } from "date-fns";
import { History, RotateCcw, GitCompare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useDocumentVersions } from "../hooks/useDocuments";
import { formatFileSize } from "../utils/fileHelpers";

type Props = {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevert?: (versionId: string) => void;
};

export function DocumentVersionHistory({ documentId, open, onOpenChange, onRevert }: Props) {
  const { data, isLoading } = useDocumentVersions(documentId ?? undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Version history
          </DialogTitle>
          <DialogDescription>All saved versions of this document.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : !data || data.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No versions found.</p>
          ) : (
            <ul className="space-y-2">
              {data.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{v.file_name}</p>
                      <Badge variant="outline" className="text-[10px]">
                        v{v.version ?? 1}
                      </Badge>
                      {v.is_current && (
                        <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">
                          Current
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatFileSize(v.file_size)} ·{" "}
                      {v.created_at ? format(new Date(v.created_at), "PPp") : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" disabled title="Coming soon">
                      <GitCompare className="h-4 w-4" />
                    </Button>
                    {!v.is_current && onRevert && (
                      <Button variant="outline" size="sm" onClick={() => onRevert(v.id)}>
                        <RotateCcw className="mr-1 h-4 w-4" /> Revert
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
