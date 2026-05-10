import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { CheckCircle2, RefreshCw, UploadCloud, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useSolicitation } from "@/features/solicitations/hooks/useSolicitations";
import { useUser } from "@/features/auth/hooks/useUser";
import { useUploadDocument } from "../hooks/useDocuments";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  formatFileSize,
  getDocumentTypeFromFilename,
  validateFile,
  type DocumentType,
} from "../utils/fileHelpers";
import { DocumentTypeSelector } from "./DocumentTypeSelector";
import { toast } from "@/hooks/use-toast";

type Status = "queued" | "uploading" | "processing" | "complete" | "failed" | "cancelled";

type UploadItem = {
  id: string;
  file: File;
  status: Status;
  progress: number;
  error?: string;
  documentType: DocumentType;
};

type Props = {
  solicitationId: string;
  compact?: boolean;
};

export function DocumentUploader({ solicitationId, compact }: Props) {
  const { data: solicitation } = useSolicitation(solicitationId);
  const { organization } = useUser();
  const upload = useUploadDocument();

  const [items, setItems] = useState<UploadItem[]>([]);
  const [pendingClassification, setPendingClassification] = useState<UploadItem[] | null>(null);

  const enqueue = useCallback((files: File[], rejected: FileRejection[]) => {
    const newOnes: UploadItem[] = [];
    for (const f of files) {
      const v = validateFile(f);
      newOnes.push({
        id: crypto.randomUUID(),
        file: f,
        status: v.valid ? "queued" : "failed",
        progress: 0,
        error: v.error,
        documentType: getDocumentTypeFromFilename(f.name),
      });
    }
    rejected.forEach((r) => {
      newOnes.push({
        id: crypto.randomUUID(),
        file: r.file,
        status: "failed",
        progress: 0,
        error: r.errors[0]?.message ?? "Rejected",
        documentType: "other",
      });
    });
    if (newOnes.some((i) => i.status === "queued")) {
      setPendingClassification(newOnes.filter((i) => i.status === "queued"));
    }
    setItems((prev) => [...newOnes, ...prev]);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: enqueue,
    accept: ALLOWED_MIME_TYPES,
    maxSize: MAX_FILE_SIZE,
    noClick: true,
    noKeyboard: true,
    multiple: true,
  });

  const startUpload = async (item: UploadItem) => {
    if (!solicitation || !organization) return;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, status: "uploading", progress: 5, error: undefined } : i))
    );
    try {
      // Simulate progress for UX (Supabase upload doesn't expose progress events natively)
      const progInt = setInterval(() => {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id && i.status === "uploading" && i.progress < 85
              ? { ...i, progress: i.progress + 10 }
              : i
          )
        );
      }, 300);

      await upload.mutateAsync({
        file: item.file,
        solicitationId: solicitation.id,
        clientId: solicitation.client_id,
        organizationId: organization.id,
        documentType: item.documentType,
      });
      clearInterval(progInt);
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: "complete", progress: 100 } : i))
      );
    } catch (e) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: "failed", progress: 0, error: e instanceof Error ? e.message : String(e) }
            : i
        )
      );
      toast({ title: "Upload failed", description: item.file.name, variant: "destructive" });
    }
  };

  const handleConfirmClassification = (assignments: Record<string, DocumentType>) => {
    setItems((prev) =>
      prev.map((i) => (assignments[i.id] ? { ...i, documentType: assignments[i.id] } : i))
    );
    const toUpload = (pendingClassification ?? []).map((i) => ({
      ...i,
      documentType: assignments[i.id] ?? i.documentType,
    }));
    setPendingClassification(null);
    toUpload.forEach((i) => void startUpload(i));
  };

  const cancel = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: "cancelled" } : i)));
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const retry = (item: UploadItem) => void startUpload({ ...item, status: "queued" });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-colors",
          isDragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30",
          compact ? "p-4" : "p-8"
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center text-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium">
              {isDragActive ? "Drop the files here" : "Drag and drop documents here"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              or click below to browse · up to 50MB · {ALLOWED_EXTENSIONS.join(", ")}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={open}>
            Browse files
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-md border bg-card p-3 text-sm"
            >
              <StatusIcon status={item.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{item.file.name}</p>
                  <span className="text-xs text-muted-foreground">{formatFileSize(item.file.size)}</span>
                </div>
                {item.status === "uploading" && <Progress value={item.progress} className="h-1.5 mt-2" />}
                {item.status === "processing" && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Processing…</p>
                )}
                {item.status === "complete" && (
                  <p className="text-xs text-emerald-600 mt-1">Uploaded</p>
                )}
                {item.status === "failed" && (
                  <p className="text-xs text-destructive mt-1 truncate">{item.error ?? "Upload failed"}</p>
                )}
                {item.status === "cancelled" && (
                  <p className="text-xs text-muted-foreground mt-1">Cancelled</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {item.status === "uploading" && (
                  <Button size="icon" variant="ghost" onClick={() => cancel(item.id)} title="Cancel">
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {(item.status === "failed" || item.status === "cancelled") && (
                  <Button size="icon" variant="ghost" onClick={() => retry(item)} title="Retry">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {item.status !== "uploading" && (
                  <Button size="icon" variant="ghost" onClick={() => remove(item.id)} title="Remove">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {pendingClassification && pendingClassification.length > 0 && (
        <DocumentTypeSelector
          items={pendingClassification.map((i) => ({
            id: i.id,
            filename: i.file.name,
            suggested: i.documentType,
          }))}
          onCancel={() => {
            const ids = new Set(pendingClassification.map((i) => i.id));
            setItems((prev) => prev.filter((i) => !ids.has(i.id)));
            setPendingClassification(null);
          }}
          onConfirm={handleConfirmClassification}
        />
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "complete")
    return <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />;
  if (status === "failed") return <AlertCircle className="h-5 w-5 text-destructive shrink-0" />;
  if (status === "uploading" || status === "processing")
    return <RefreshCw className="h-5 w-5 text-primary animate-spin shrink-0" />;
  if (status === "cancelled") return <X className="h-5 w-5 text-muted-foreground shrink-0" />;
  return <UploadCloud className="h-5 w-5 text-muted-foreground shrink-0" />;
}
