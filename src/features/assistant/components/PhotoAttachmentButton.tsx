import { useRef } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { validatePhotos } from "../hooks/useAssistantAttachments";

type Props = {
  pending: File[];
  onAdd: (files: File[]) => void;
  disabled?: boolean;
};

export function PhotoAttachmentButton({ pending, onAdd, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file
    if (!files.length) return;
    const { accepted, errors } = validatePhotos(pending, files);
    if (errors.some((er) => er.kind === "too_many")) {
      toast({ title: "Photo limit reached", description: "Up to 4 photos per message.", variant: "destructive" });
    }
    const tooLarge = errors.filter((er) => er.kind === "too_large");
    if (tooLarge.length) {
      toast({
        title: "Photo too large",
        description: `${tooLarge.map((er) => er.file?.name).filter(Boolean).join(", ")} exceeds 8MB.`,
        variant: "destructive",
      });
    }
    const badType = errors.filter((er) => er.kind === "bad_type");
    if (badType.length) {
      toast({
        title: "Unsupported file",
        description: `${badType.map((er) => er.file?.name).filter(Boolean).join(", ")} isn't an image.`,
        variant: "destructive",
      });
    }
    if (accepted.length) onAdd(accepted);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // `capture` is a hint for mobile; desktop ignores it.
        // Not setting it lets desktop users pick from the library easily.
        capture="environment"
        multiple
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        title="Attach photo"
        aria-label="Attach photo"
      >
        <Camera className="h-4 w-4" />
      </Button>
    </>
  );
}
