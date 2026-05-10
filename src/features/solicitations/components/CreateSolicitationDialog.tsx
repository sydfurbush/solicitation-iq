import { ReactNode, useState } from "react";
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
import { SolicitationForm } from "./SolicitationForm";
import { useCreateSolicitation } from "../hooks/useSolicitations";
import { toast } from "@/hooks/use-toast";

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
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const createMut = useCreateSolicitation();

  const handleOpenChange = (v: boolean) => {
    if (!v && dirty) {
      setConfirmClose(true);
      return;
    }
    setOpen(v);
  };

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
          <SolicitationForm
            defaultValues={defaultClientId ? { client_id: defaultClientId } : undefined}
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
              } catch (e) {
                toast({
                  title: "Could not create",
                  description: e instanceof Error ? e.message : String(e),
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
