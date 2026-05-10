import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useDocuments } from "@/features/documents/hooks/useDocuments";
import { useOrgMembers } from "@/features/collaboration/hooks/useOrgMembers";
import {
  useAnnotations,
  useDeleteAnnotation,
  useResolveAnnotation,
  useUpdateAnnotation,
  type AnnotationFilters,
} from "../hooks/useAnnotations";
import { AnnotationCard } from "./AnnotationCard";
import {
  ANNOTATION_LABEL,
  ANNOTATION_TYPES,
  type AnnotationRow,
  type AnnotationType,
} from "../utils/annotationHelpers";

interface Props {
  solicitationId: string;
  isAdmin?: boolean;
  groupByDocument?: boolean;
}

export function AnnotationsList({ solicitationId, isAdmin, groupByDocument }: Props) {
  const { user } = useAuth();
  const [type, setType] = useState<AnnotationType | "all">("all");
  const [authorId, setAuthorId] = useState<string | "all" | "me">("all");
  const [resolved, setResolved] = useState<"all" | "open" | "resolved">("all");

  const filters = useMemo<AnnotationFilters>(() => ({
    types: type === "all" ? undefined : [type],
    authorId: authorId === "all" ? undefined : authorId === "me" ? user?.id : authorId,
    resolved,
  }), [type, authorId, resolved, user?.id]);

  const { data: annotations = [], isLoading } = useAnnotations(solicitationId, filters);
  const { data: documents = [] } = useDocuments(solicitationId);
  const { data: members = [] } = useOrgMembers();

  const updateAnn = useUpdateAnnotation(solicitationId);
  const deleteAnn = useDeleteAnnotation(solicitationId);
  const resolveAnn = useResolveAnnotation(solicitationId);

  const [confirmDelete, setConfirmDelete] = useState<AnnotationRow | null>(null);

  const docMap = useMemo(() => {
    const m = new Map<string, string>();
    documents.forEach((d) => m.set(d.id, d.file_name));
    return m;
  }, [documents]);

  const grouped = useMemo(() => {
    if (!groupByDocument) return null;
    const map = new Map<string, AnnotationRow[]>();
    annotations.forEach((a) => {
      const key = a.document_id ?? "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return map;
  }, [annotations, groupByDocument]);

  const unresolved = annotations.filter((a) => !a.is_resolved).length;

  const handleUpdate = async (id: string, content: string) => {
    try {
      await updateAnn.mutateAsync({ id, updates: { content } });
      toast({ title: "Annotation updated" });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleResolve = async (id: string, next: boolean) => {
    try {
      await resolveAnn.mutateAsync({ id, resolved: next });
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteAnn.mutateAsync(confirmDelete.id);
      toast({ title: "Annotation deleted" });
      setConfirmDelete(null);
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={type} onValueChange={(v) => setType(v as AnnotationType | "all")}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {ANNOTATION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{ANNOTATION_LABEL[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={authorId} onValueChange={(v) => setAuthorId(v as typeof authorId)}>
          <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            <SelectItem value="me">Mine</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name ?? m.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={resolved} onValueChange={(v) => setResolved(v as typeof resolved)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant={unresolved > 0 ? "destructive" : "secondary"} className="ml-auto">
          {unresolved} unresolved
        </Badge>
      </div>

      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : annotations.length === 0 ? (
        <p className="text-sm text-center text-muted-foreground py-10">
          No annotations match your filters.
        </p>
      ) : grouped ? (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([docId, list]) => (
            <div key={docId} className="space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">
                  {docId === "—" ? "Unlinked" : docMap.get(docId) ?? "Unknown document"}
                </h4>
                <Badge variant="secondary">{list.length}</Badge>
              </div>
              <div className="space-y-3">
                {list.map((a) => (
                  <AnnotationCard
                    key={a.id}
                    annotation={a}
                    documentName={a.document_id ? docMap.get(a.document_id) : undefined}
                    isAdmin={isAdmin}
                    onUpdate={handleUpdate}
                    onResolveToggle={handleResolve}
                    onDelete={(x) => setConfirmDelete(x)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {annotations.map((a) => (
            <AnnotationCard
              key={a.id}
              annotation={a}
              documentName={a.document_id ? docMap.get(a.document_id) : undefined}
              isAdmin={isAdmin}
              onUpdate={handleUpdate}
              onResolveToggle={handleResolve}
              onDelete={(x) => setConfirmDelete(x)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete annotation?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
