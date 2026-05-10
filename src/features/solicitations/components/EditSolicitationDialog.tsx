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
import { useUpdateSolicitation } from "../hooks/useSolicitations";
import type { SolicitationRow } from "../hooks/useSolicitations";
import type { SolicitationFullInput, SetAsideType } from "@/lib/validators/solicitation";
import { toast } from "@/hooks/use-toast";

interface Props {
  trigger: ReactNode;
  solicitation: SolicitationRow;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function toFormDefaults(s: SolicitationRow): Partial<SolicitationFullInput> {
  const meta = (s.metadata ?? {}) as { notes?: string };
  return {
    client_id: s.client_id,
    title: s.title,
    solicitation_number: s.solicitation_number ?? "",
    issuing_agency: s.issuing_agency ?? "",
    agency_type: (s.agency_type ?? undefined) as SolicitationFullInput["agency_type"],
    contract_type: (s.contract_type ?? undefined) as SolicitationFullInput["contract_type"],
    set_aside: ((s as { set_aside?: string | null }).set_aside ?? undefined) as SetAsideType | undefined,
    sam_url: ((s as { sam_url?: string | null }).sam_url ?? "") as string,
    release_date: s.release_date ?? "",
    questions_due_date: s.questions_due_date ?? "",
    proposal_due_date: s.proposal_due_date ?? "",
    expected_award_date: s.expected_award_date ?? "",
    period_of_performance_start: s.period_of_performance_start ?? "",
    period_of_performance_end: s.period_of_performance_end ?? "",
    estimated_value_low: s.estimated_value_low ?? undefined,
    estimated_value_high: s.estimated_value_high ?? undefined,
    has_incumbent: s.has_incumbent ?? false,
    incumbent_name: s.incumbent_name ?? "",
    incumbent_contract_number: s.incumbent_contract_number ?? "",
    incumbent_contract_value: s.incumbent_contract_value ?? undefined,
    incumbent_performance_notes: s.incumbent_performance_notes ?? "",
    tags: s.tags ?? [],
    notes: meta.notes ?? "",
  };
}

export function EditSolicitationDialog({
  trigger,
  solicitation,
  open,
  onOpenChange,
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

  const updateMut = useUpdateSolicitation();

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
            <DialogTitle>Edit solicitation</DialogTitle>
            <DialogDescription>Update any details for this solicitation.</DialogDescription>
          </DialogHeader>
          <SolicitationForm
            defaultValues={toFormDefaults(solicitation)}
            submitLabel="Save changes"
            isSubmitting={updateMut.isPending}
            onDirtyChange={setDirty}
            onSubmit={async (values) => {
              try {
                await updateMut.mutateAsync({ id: solicitation.id, input: values });
                toast({ title: "Saved", description: values.title });
                setDirty(false);
                setOpen(false);
              } catch (e) {
                toast({
                  title: "Could not save",
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
