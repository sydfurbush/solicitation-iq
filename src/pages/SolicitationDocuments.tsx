import { useMemo, useState } from "react";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import {
  downloadDocument,
  useDeleteDocument,
  useDocuments,
  type DocumentRow,
} from "@/features/documents/hooks/useDocuments";
import { DocumentList } from "@/features/documents/components/DocumentList";
import { DocumentUploader } from "@/features/documents/components/DocumentUploader";
import { DocumentsEmptyState } from "@/features/documents/components/DocumentsEmptyState";
import { DocumentViewer } from "@/features/documents/components/DocumentViewer";
import { DocumentVersionHistory } from "@/features/documents/components/DocumentVersionHistory";
import { ProcessAllDocuments } from "@/features/documents/components/ProcessAllDocuments";
import { DocumentSearchBar } from "@/features/documents/components/DocumentSearchBar";
import { invokeProcessDocument } from "@/lib/supabase/functions";

export default function SolicitationDocuments({ solicitationId }: { solicitationId: string }) {
  const { data: documents, isLoading } = useDocuments(solicitationId);
  const deleteDoc = useDeleteDocument();

  const [uploaderOpen, setUploaderOpen] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<DocumentRow | null>(null);
  const [versionDocId, setVersionDocId] = useState<string | null>(null);
  const [replaceDoc, setReplaceDoc] = useState<DocumentRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DocumentRow | null>(null);

  const docs = documents ?? [];
  const stats = useMemo(() => {
    const total = docs.length;
    const analyzed = docs.filter((d) => d.status === "analyzed").length;
    return { total, analyzed };
  }, [docs]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (docs.length === 0) {
    return <DocumentsEmptyState solicitationId={solicitationId} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Documents</h2>
            <p className="text-xs text-muted-foreground">
              {stats.analyzed} of {stats.total} document{stats.total === 1 ? "" : "s"} analyzed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DocumentSearchBar
            solicitationId={solicitationId}
            onResultClick={(r) => {
              const d = docs.find((x) => x.id === r.document_id);
              if (d) setViewerDoc(d);
            }}
          />
          <ProcessAllDocuments documents={docs} solicitationId={solicitationId} />
          <Button onClick={() => setUploaderOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Upload documents
          </Button>
        </div>
      </div>

      {uploaderOpen && (
        <Card>
          <CardContent className="p-4">
            <DocumentUploader solicitationId={solicitationId} compact />
          </CardContent>
        </Card>
      )}

      <DocumentList
        documents={docs}
        onView={setViewerDoc}
        onDownload={(d) => void downloadDocument(d)}
        onReplace={setReplaceDoc}
        onShowVersions={(d) => setVersionDocId(d.id)}
        onDelete={setConfirmDelete}
        onBulkDelete={(items) => {
          items.forEach((d) => deleteDoc.mutate(d));
          toast({ title: `Deleted ${items.length} document(s)` });
        }}
        onBulkReprocess={() =>
          toast({ title: "Re-processing", description: "AI analysis will be available soon." })
        }
      />

      <DocumentViewer
        document={viewerDoc}
        open={!!viewerDoc}
        onOpenChange={(o) => !o && setViewerDoc(null)}
      />

      <DocumentVersionHistory
        documentId={versionDocId}
        open={!!versionDocId}
        onOpenChange={(o) => !o && setVersionDocId(null)}
      />

      {/* Replace dialog */}
      <Dialog open={!!replaceDoc} onOpenChange={(o) => !o && setReplaceDoc(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload a new version</DialogTitle>
            <DialogDescription>
              Replacing <span className="font-medium">{replaceDoc?.file_name}</span>. The previous
              version will be kept in history.
            </DialogDescription>
          </DialogHeader>
          {replaceDoc && (
            <ReplaceUploader
              solicitationId={solicitationId}
              replaces={replaceDoc}
              onDone={() => setReplaceDoc(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
            <DialogDescription>
              This will remove <span className="font-medium">{confirmDelete?.file_name}</span> from
              this solicitation. You can restore it later from history.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!confirmDelete) return;
                await deleteDoc.mutateAsync(confirmDelete);
                toast({ title: "Document deleted" });
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReplaceUploader({
  solicitationId,
  replaces,
  onDone,
}: {
  solicitationId: string;
  replaces: DocumentRow;
  onDone: () => void;
}) {
  // We render the regular uploader but inject a `replaces` context via a wrapper.
  // For simplicity, the regular uploader doesn't accept replaces; we trigger it manually.
  return (
    <ReplaceForm solicitationId={solicitationId} replaces={replaces} onDone={onDone} />
  );
}

import { useUser } from "@/features/auth/hooks/useUser";
import { useSolicitation } from "@/features/solicitations/hooks/useSolicitations";
import { useUploadDocument } from "@/features/documents/hooks/useDocuments";
import { Progress } from "@/components/ui/progress";
import { validateFile } from "@/features/documents/utils/fileHelpers";

function ReplaceForm({
  solicitationId,
  replaces,
  onDone,
}: {
  solicitationId: string;
  replaces: DocumentRow;
  onDone: () => void;
}) {
  const { data: solicitation } = useSolicitation(solicitationId);
  const { organization } = useUser();
  const upload = useUploadDocument();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async (file: File) => {
    setError(null);
    const v = validateFile(file);
    if (!v.valid) {
      setError(v.error ?? "Invalid file");
      return;
    }
    if (!solicitation || !organization) return;
    try {
      setProgress(20);
      await upload.mutateAsync({
        file,
        solicitationId: solicitation.id,
        clientId: solicitation.client_id,
        organizationId: organization.id,
        documentType: replaces.document_type ?? "other",
        replacesDocumentId: replaces.id,
        onProgress: setProgress,
      });
      setProgress(100);
      toast({ title: "New version uploaded" });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-3">
      <input
        type="file"
        className="block w-full text-sm"
        onChange={(e) => e.target.files?.[0] && handlePick(e.target.files[0])}
      />
      {progress > 0 && progress < 100 && <Progress value={progress} className="h-1.5" />}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
