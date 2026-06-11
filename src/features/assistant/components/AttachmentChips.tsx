import { useEffect, useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  files: File[];
  onRemove: (index: number) => void;
};

export function AttachmentChips({ files, onRemove }: Props) {
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [urls]);
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {files.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          className="relative h-16 w-16 rounded-md overflow-hidden border bg-muted shrink-0"
        >
          <img src={urls[i]} alt={f.name} className="h-full w-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full shadow"
            onClick={() => onRemove(i)}
            title="Remove"
            aria-label={`Remove ${f.name}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
