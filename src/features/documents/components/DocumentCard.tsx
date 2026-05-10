import { format } from "date-fns";
import {
  Download,
  Eye,
  History,
  MoreVertical,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPE_LABELS,
  formatFileSize,
  getFileIcon,
} from "../utils/fileHelpers";
import type { DocumentRow, DocumentStatus } from "../hooks/useDocuments";

type Props = {
  document: DocumentRow;
  selected?: boolean;
  onSelectChange?: (checked: boolean) => void;
  onView?: (doc: DocumentRow) => void;
  onDownload?: (doc: DocumentRow) => void;
  onReplace?: (doc: DocumentRow) => void;
  onDelete?: (doc: DocumentRow) => void;
  onShowVersions?: (doc: DocumentRow) => void;
  onRetry?: (doc: DocumentRow) => void;
};

const STATUS_STYLES: Record<DocumentStatus, { label: string; className: string }> = {
  uploading: { label: "Uploading", className: "bg-blue-500/15 text-blue-600 dark:text-blue-400" },
  processing: {
    label: "Analyzing…",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-500",
  },
  parsed: { label: "Ready", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-500" },
  analyzed: {
    label: "Analyzed",
    className: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
  },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive" },
};

export function DocumentCard({
  document: doc,
  selected,
  onSelectChange,
  onView,
  onDownload,
  onReplace,
  onDelete,
  onShowVersions,
  onRetry,
}: Props) {
  const Icon = getFileIcon(doc.file_type ?? doc.file_name);
  const status = (doc.status ?? "parsed") as DocumentStatus;
  const statusCfg = STATUS_STYLES[status];

  return (
    <Card className="group relative overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          {onSelectChange && (
            <Checkbox
              checked={!!selected}
              onCheckedChange={(v) => onSelectChange(v === true)}
              className="mt-1"
              aria-label="Select document"
            />
          )}
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <p className="font-medium text-sm truncate">{doc.file_name}</p>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-sm break-all">
                {doc.file_name}
              </TooltipContent>
            </Tooltip>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {doc.document_type && (
                <Badge variant="secondary" className="text-[10px]">
                  {DOCUMENT_TYPE_LABELS[doc.document_type]}
                </Badge>
              )}
              <Badge variant="outline" className={cn("text-[10px]", statusCfg.className)}>
                {statusCfg.label}
              </Badge>
              {doc.version && doc.version > 1 && (
                <Badge variant="outline" className="text-[10px]">
                  v{doc.version}
                </Badge>
              )}
              {!doc.is_current && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Superseded
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onView?.(doc)}>
                <Eye className="mr-2 h-4 w-4" /> View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDownload?.(doc)}>
                <Download className="mr-2 h-4 w-4" /> Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onReplace?.(doc)}>
                <Upload className="mr-2 h-4 w-4" /> Replace (new version)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onShowVersions?.(doc)}>
                <History className="mr-2 h-4 w-4" /> Version history
              </DropdownMenuItem>
              {status === "failed" && (
                <DropdownMenuItem onClick={() => onRetry?.(doc)}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Retry processing
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete?.(doc)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{formatFileSize(doc.file_size)}</span>
          {doc.total_pages != null && <span>{doc.total_pages} pages</span>}
          {doc.created_at && <span>{format(new Date(doc.created_at), "MMM d, yyyy")}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
