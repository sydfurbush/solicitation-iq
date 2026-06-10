import { ReactNode, useState } from "react";
import { formatSupabaseError } from "@/lib/supabase/formatError";
import { Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SolicitationForm } from "./SolicitationForm";
import { useCreateSolicitation } from "../hooks/useSolicitations";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { SolicitationFullInput } from "@/lib/validators/solicitation";

interface Props {
  trigger: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultClientId?: string;
  onCreated?: (id: string) => void;
}

export function CreateSolicitationDialog({
  trigger,
  open,
  onOpenChange,
  defaultClientId,
  onCreated,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [samUrl, setSamUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [prefill, setPrefill] = useState<Partial<SolicitationFullInput> | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [attachments, setAttachments] = useState<{ href: string }[]>([]);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
    if (!v) {
      // reset on close
      setSamUrl("");
      setPrefill(null);
      setAttachments([]);
      setFormKey((k) => k + 1);
    }
  };

  const createMut = useCreateSolicitation();

  const handleOpenChange = (v: boolean) => {
    if (!v && dirty) {
      setConfirmClose(true);
      return;
    }
    setOpen(v);
  };

  const handleImport = async () => {
    if (!samUrl.trim()) return;
    setImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("sam-import", {
        body: { url: samUrl.trim() },
      });
      if (error) throw error;
      const p = (data as { prefill?: Partial<SolicitationFullInput> & { attachments?: { href: string }[] } })?.prefill;
      if (!p) throw new Error("No data returned");
      const { attachments: att, ...rest } = p;
      setPrefill({
        ...(defaultClientId ? { client_id: defaultClientId } : {}),
        ...rest,
      });
      setAttachments(att ?? []);
      setFormKey((k) => k + 1);
      toast({
        title: "Imported from SAM.gov",
        description: rest.title ?? "Review the prefilled fields.",
      });
    } catch (e) {
      toast({
        title: "SAM.gov import failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const initialDefaults: Partial<SolicitationFullInput> | undefined =
    prefill ?? (defaultClientId ? { client_id: defaultClientId } : undefined);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New solicitation</DialogTitle>
            <DialogDescription>
              Capture the basics now — you can fill in details later.
            </DialogDescription>
          </DialogHeader>

          {/* SAM.gov import bar */}
          <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-2">
            <Label className="flex items-center gap-1.5 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Import from SAM.gov (optional)
            </Label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://sam.gov/opp/<noticeId>/view"
                value={samUrl}
                onChange={(e) => setSamUrl(e.target.value)}
                disabled={importing}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleImport}
                disabled={importing || !samUrl.trim()}
              >
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Prefill"}
              </Button>
            </div>
            {attachments.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {attachments.length} attachment{attachments.length > 1 ? "s" : ""} found on SAM.gov.
                They will be imported automatically when you create the solicitation.
              </p>
            )}
          </div>

          <SolicitationForm
            key={formKey}
            defaultValues={initialDefaults}
            isSubmitting={createMut.isPending}
            onDirtyChange={setDirty}
            onSubmit={async (values, asDraft) => {
              try {
                const created = await createMut.mutateAsync(values);
                toast({
                  title: asDraft ? "Draft saved" : "Solicitation created",
                  description: created.title,
                });
                setDirty(false);
                setOpen(false);
                onCreated?.(created.id);

                if (attachments.length > 0) {
                  toast({
                    title: `Importing ${attachments.length} attachment${attachments.length > 1 ? "s" : ""} from SAM.gov…`,
                  });
                  supabase.functions
                    .invoke("sam-import-attachments", {
                      body: { solicitationId: created.id, attachments },
                    })
                    .then(({ data, error }) => {
                      if (error) throw error;
                      const r = data as { imported?: number; total?: number; failed?: { error?: string; status?: number }[] };
                      const failedItems = r?.failed ?? [];
                      const firstErr = failedItems[0]?.error;
                      toast({
                        title: `Imported ${r?.imported ?? 0} of ${r?.total ?? attachments.length} attachment(s)`,
                        description: failedItems.length
                          ? `${failedItems.length} failed${firstErr ? ` — ${firstErr.slice(0, 200)}` : ""}`
                          : undefined,
                        variant: failedItems.length && !r?.imported ? "destructive" : undefined,
                      });
                    })
                    .catch((e) => {
                      toast({
                        title: "Attachment import failed",
                        description: e instanceof Error ? e.message : String(e),
                        variant: "destructive",
                      });
                    });
                }
              } catch (e) {
                console.error("Create solicitation failed:", e);
                toast({
                  title: "Could not create",
                  description: formatSupabaseError(e),
                  variant: "destructive",
                });
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Closing will lose them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmClose(false);
                setDirty(false);
                setOpen(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
