import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "../utils/fileHelpers";
import { DocumentCard } from "./DocumentCard";
import type { DocumentRow, DocumentStatus } from "../hooks/useDocuments";

type Props = {
  documents: DocumentRow[];
  onView?: (doc: DocumentRow) => void;
  onDownload?: (doc: DocumentRow) => void;
  onReplace?: (doc: DocumentRow) => void;
  onDelete?: (doc: DocumentRow) => void;
  onShowVersions?: (doc: DocumentRow) => void;
  onBulkDelete?: (docs: DocumentRow[]) => void;
  onBulkReprocess?: (docs: DocumentRow[]) => void;
  onRetry?: (doc: DocumentRow) => void;
};

type SortKey = "created_at" | "file_name" | "document_type" | "status";

export function DocumentList({
  documents,
  onView,
  onDownload,
  onReplace,
  onDelete,
  onShowVersions,
  onBulkDelete,
  onBulkReprocess,
  onRetry,
}: Props) {
  const [sort, setSort] = useState<SortKey>("created_at");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "all">("all");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    return documents
      .filter((d) => (typeFilter === "all" ? true : d.document_type === typeFilter))
      .filter((d) => (statusFilter === "all" ? true : d.status === statusFilter))
      .sort((a, b) => {
        if (sort === "file_name") return a.file_name.localeCompare(b.file_name);
        if (sort === "document_type")
          return (a.document_type ?? "").localeCompare(b.document_type ?? "");
        if (sort === "status") return (a.status ?? "").localeCompare(b.status ?? "");
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      });
  }, [documents, sort, typeFilter, statusFilter]);

  const grouped = useMemo(() => {
    const map = new Map<DocumentType, DocumentRow[]>();
    filtered.forEach((d) => {
      const k = (d.document_type ?? "other") as DocumentType;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(d);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const selectedDocs = filtered.filter((d) => selected[d.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as DocumentType | "all")}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as DocumentStatus | "all")}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="uploading">Uploading</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="parsed">Ready</SelectItem>
              <SelectItem value="analyzed">Analyzed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Newest first</SelectItem>
              <SelectItem value="file_name">Name</SelectItem>
              <SelectItem value="document_type">Type</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedDocs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selectedDocs.length} selected</span>
            <Button variant="outline" size="sm" onClick={() => onBulkReprocess?.(selectedDocs)}>
              <RefreshCw className="mr-1 h-4 w-4" /> Re-process
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              onClick={() => {
                onBulkDelete?.(selectedDocs);
                setSelected({});
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {grouped.map(([type, docs]) => {
          const isCollapsed = collapsed[type];
          return (
            <section key={type}>
              <button
                type="button"
                onClick={() => setCollapsed((c) => ({ ...c, [type]: !c[type] }))}
                className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {DOCUMENT_TYPE_LABELS[type]}
                <span className="text-xs">({docs.length})</span>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {docs.map((d) => (
                    <DocumentCard
                      key={d.id}
                      document={d}
                      selected={!!selected[d.id]}
                      onSelectChange={(checked) =>
                        setSelected((prev) => ({ ...prev, [d.id]: checked }))
                      }
                      onView={onView}
                      onDownload={onDownload}
                      onReplace={onReplace}
                      onDelete={onDelete}
                      onShowVersions={onShowVersions}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
