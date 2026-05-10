import { ReactNode, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ClientForm } from "./ClientForm";
import { useCreateClient, useUpdateClient, type ClientRow } from "../hooks/useClients";
import { toast } from "@/hooks/use-toast";

interface Props {
  trigger: ReactNode;
  client?: ClientRow;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateClientDialog({ trigger, client, open, onOpenChange }: Props) {
  const isEdit = !!client;
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const createMut = useCreateClient();
  const updateMut = useUpdateClient();
  const isSubmitting = createMut.isPending || updateMut.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit client" : "Add client"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update client details and access level."
              : "Add a client whose solicitations you'll analyze."}
          </DialogDescription>
        </DialogHeader>
        <ClientForm
          defaultValues={client ?? undefined}
          isSubmitting={isSubmitting}
          submitLabel={isEdit ? "Save changes" : "Create client"}
          onCancel={() => setOpen(false)}
          onSubmit={async (values) => {
            try {
              if (isEdit && client) {
                await updateMut.mutateAsync({ id: client.id, input: values });
                toast({ title: "Client updated" });
              } else {
                await createMut.mutateAsync(values);
                toast({ title: "Client created" });
              }
              setOpen(false);
            } catch (e) {
              toast({
                title: isEdit ? "Update failed" : "Create failed",
                description: e instanceof Error ? e.message : String(e),
                variant: "destructive",
              });
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
