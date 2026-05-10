import { FileSearch, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  hasFilters: boolean;
  onCreate: () => void;
  onClearFilters?: () => void;
}

export function SolicitationsEmptyState({ hasFilters, onCreate, onClearFilters }: Props) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4 border-2 border-dashed rounded-lg bg-muted/20">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
          <Filter className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-semibold">No solicitations match your filters</h3>
        <p className="text-sm text-muted-foreground max-w-md mt-2">
          Try removing some filters or broadening your search.
        </p>
        {onClearFilters && (
          <Button variant="outline" className="mt-6" onClick={onClearFilters}>
            Clear filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-4 border-2 border-dashed rounded-lg bg-muted/20">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
        <FileSearch className="h-8 w-8" />
      </div>
      <h3 className="text-lg font-semibold">No solicitations yet</h3>
      <p className="text-sm text-muted-foreground max-w-md mt-2">
        Solicitations are RFPs, RFQs, or RFIs you analyze for clients. Create your first to start
        building intelligence.
      </p>
      <Button className="mt-6" onClick={onCreate}>
        <Plus className="mr-2 h-4 w-4" /> Create your first solicitation
      </Button>
    </div>
  );
}
