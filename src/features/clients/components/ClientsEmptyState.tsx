import { Users, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  onAdd: () => void;
}

export function ClientsEmptyState({ onAdd }: Props) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 border-2 border-dashed rounded-lg bg-muted/20">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
        <Users className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold">No clients yet</h3>
      <p className="text-sm text-muted-foreground max-w-md mt-2">
        Clients are the organizations you analyze solicitations for. Add your first client to start
        organizing RFPs, RFQs, and intelligence reports.
      </p>
      <Button className="mt-6" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" /> Add your first client
      </Button>
    </div>
  );
}
