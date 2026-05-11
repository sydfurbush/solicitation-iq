import { useEffect, useMemo, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import {
  exportDocument,
  type ExportDocument,
  type ExportFormat,
  type ExportPageSize,
} from "@/features/exports/lib/exporters";

interface Props {
  /** Lazy builder so we only assemble the doc on click */
  build: () => ExportDocument | null;
  disabled?: boolean;
  label?: string;
}

export function ExportMenu({ build, disabled, label = "Export" }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [doc, setDoc] = useState<ExportDocument | null>(null);

  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [pageSize, setPageSize] = useState<ExportPageSize>("letter");
  const [filename, setFilename] = useState("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  const openDialog = () => {
    const built = build();
    if (!built) {
      toast({
        title: "Nothing to export",
        description: "Generate the content first.",
        variant: "destructive",
      });
      return;
    }
    setDoc(built);
    setFilename(built.filenameBase);
    setSelected(Object.fromEntries(built.sections.map((_, i) => [i, true])));
    setOpen(true);
  };

  // Reset transient state when closing
  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);

  const allOn = useMemo(
    () => doc ? doc.sections.every((_, i) => selected[i]) : false,
    [doc, selected],
  );
  const noneOn = useMemo(
    () => doc ? doc.sections.every((_, i) => !selected[i]) : true,
    [doc, selected],
  );

  const toggleAll = (on: boolean) => {
    if (!doc) return;
    setSelected(Object.fromEntries(doc.sections.map((_, i) => [i, on])));
  };

  const handleExport = async () => {
    if (!doc) return;
    const sections = doc.sections.filter((_, i) => selected[i]);
    if (sections.length === 0) {
      toast({
        title: "Select at least one section",
        variant: "destructive",
      });
      return;
    }
    try {
      setBusy(true);
      await exportDocument({ ...doc, sections }, format, {
        pageSize,
        filenameBase: filename || doc.filenameBase,
      });
      toast({ title: "Export ready", description: `${format.toUpperCase()} downloaded.` });
      setOpen(false);
    } catch (e) {
      toast({
        title: "Export failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" disabled={disabled} onClick={openDialog}>
        <Download className="h-4 w-4 mr-2" />
        {label}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Export settings</DialogTitle>
            <DialogDescription>
              Choose what to include and how the file should be formatted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Format */}
            <div className="space-y-2">
              <Label>Format</Label>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as ExportFormat)}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="fmt-pdf"
                  className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem id="fmt-pdf" value="pdf" />
                  <span className="text-sm">PDF</span>
                </Label>
                <Label
                  htmlFor="fmt-docx"
                  className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem id="fmt-docx" value="docx" />
                  <span className="text-sm">Word (.docx)</span>
                </Label>
              </RadioGroup>
            </div>

            {/* Page size */}
            <div className="space-y-2">
              <Label>Page size</Label>
              <RadioGroup
                value={pageSize}
                onValueChange={(v) => setPageSize(v as ExportPageSize)}
                className="grid grid-cols-2 gap-2"
              >
                <Label
                  htmlFor="ps-letter"
                  className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem id="ps-letter" value="letter" />
                  <span className="text-sm">US Letter (8.5 × 11 in)</span>
                </Label>
                <Label
                  htmlFor="ps-a4"
                  className="flex items-center gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent"
                >
                  <RadioGroupItem id="ps-a4" value="a4" />
                  <span className="text-sm">A4 (210 × 297 mm)</span>
                </Label>
              </RadioGroup>
            </div>

            {/* Filename */}
            <div className="space-y-2">
              <Label htmlFor="export-filename">Filename</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="export-filename"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder={doc?.filenameBase ?? "export"}
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  _YYYY-MM-DD.{format}
                </span>
              </div>
            </div>

            {/* Sections */}
            {doc && doc.sections.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Sections</Label>
                  <button
                    type="button"
                    onClick={() => toggleAll(!allOn)}
                    className="text-xs text-primary hover:underline"
                  >
                    {allOn ? "Clear all" : "Select all"}
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-md border divide-y">
                  {doc.sections.map((s, i) => (
                    <label
                      key={`${i}-${s.heading}`}
                      htmlFor={`sec-${i}`}
                      className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-accent text-sm"
                    >
                      <Checkbox
                        id={`sec-${i}`}
                        checked={!!selected[i]}
                        onCheckedChange={(c) =>
                          setSelected((prev) => ({ ...prev, [i]: !!c }))
                        }
                      />
                      <span className="flex-1 truncate">{s.heading}</span>
                    </label>
                  ))}
                </div>
                {noneOn && (
                  <p className="text-xs text-destructive">Select at least one section.</p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={busy || noneOn}>
              {busy ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
