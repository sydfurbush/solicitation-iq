import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { APPROVAL_NOTE_MAX, validateNote } from "../validators";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  required?: boolean;
  isSubmitting?: boolean;
  onConfirm: (note: string) => void | Promise<void>;
}

export function ApprovalNoteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  required = false,
  isSubmitting = false,
  onConfirm,
}: Props) {
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const error = touched ? validateNote(note, required) : null;
  const remaining = APPROVAL_NOTE_MAX - note.length;
  const overLimit = note.length > APPROVAL_NOTE_MAX;

  const handleConfirm = async () => {
    setTouched(true);
    if (validateNote(note, required)) return;
    await onConfirm(note.trim());
    setNote("");
    setTouched(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setNote("");
          setTouched(false);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="approval-note-dialog" className="text-sm">
              Note {required ? <span className="text-destructive ml-0.5">*</span> : <span className="text-muted-foreground">(optional)</span>}
            </Label>
            <span
              className={cn("text-xs", overLimit ? "text-destructive" : "text-muted-foreground")}
              aria-live="polite"
            >
              {remaining} characters left
            </span>
          </div>
          <Textarea
            id="approval-note-dialog"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={3}
            maxLength={APPROVAL_NOTE_MAX + 50}
            placeholder={required ? "Required context for the client" : "Optional context for the client"}
            aria-invalid={!!error}
            aria-describedby={error ? "approval-note-dialog-error" : undefined}
            className={cn(error && "border-destructive focus-visible:ring-destructive")}
          />
          {error && (
            <p id="approval-note-dialog-error" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSubmitting || overLimit || (required && !note.trim())}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
