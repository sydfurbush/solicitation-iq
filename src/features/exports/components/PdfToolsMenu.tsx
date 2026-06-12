import { useRef, useState } from "react";
import { Combine, Droplets, Lock, Loader2, FileCog } from "lucide-react";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "@/hooks/use-toast";
import { mergePdfs, watermarkPdf, protectPdf } from "@/lib/pdf/pdfRecipes";
import { slugifyFilename } from "@/lib/pdf/pdfKit";

type PendingAction = null | "watermark" | "protect";

export function PdfToolsMenu() {
  const mergeInputRef = useRef<HTMLInputElement | null>(null);
  const singleInputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<PendingAction>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [watermarkText, setWatermarkText] = useState("DRAFT");
  const [password, setPassword] = useState("");

  const pickMerge = () => mergeInputRef.current?.click();
  const pickSingle = (which: Exclude<PendingAction, null>) => {
    setAction(which);
    singleInputRef.current?.value = "";
    singleInputRef.current?.click();
  };

  const handleMerge = async (files: FileList | null) => {
    if (!files || files.length < 2) {
      toast({ title: "Pick at least two PDFs to combine", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const blobs = Array.from(files);
      const merged = await mergePdfs(blobs);
      saveAs(merged, slugifyFilename(["combined"]));
      toast({ title: `Combined ${files.length} PDFs` });
    } catch (e) {
      toast({ title: "Combine failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
      if (mergeInputRef.current) mergeInputRef.current.value = "";
    }
  };

  const handleSinglePicked = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPendingFile(files[0]);
  };

  const runWatermark = async () => {
    if (!pendingFile || !watermarkText.trim()) return;
    setBusy(true);
    try {
      const out = await watermarkPdf(pendingFile, { text: watermarkText.trim().toUpperCase() });
      saveAs(out, slugifyFilename([pendingFile.name.replace(/\.pdf$/i, ""), "stamped"]));
      toast({ title: "Watermark applied" });
      closeDialog();
    } catch (e) {
      toast({ title: "Watermark failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const runProtect = async () => {
    if (!pendingFile || !password.trim()) return;
    setBusy(true);
    try {
      const out = await protectPdf(pendingFile, { userPassword: password });
      saveAs(out, slugifyFilename([pendingFile.name.replace(/\.pdf$/i, ""), "protected"]));
      toast({ title: "Password protection applied" });
      closeDialog();
    } catch (e) {
      toast({ title: "Protect failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const closeDialog = () => {
    setAction(null);
    setPendingFile(null);
    setPassword("");
    setWatermarkText("DRAFT");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs gap-1.5"
            disabled={busy}
            title="PDF tools"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCog className="h-3.5 w-3.5" />}
            PDF tools
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={pickMerge}>
            <Combine className="h-3.5 w-3.5 mr-2" />
            Combine PDFs…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => pickSingle("watermark")}>
            <Droplets className="h-3.5 w-3.5 mr-2" />
            Stamp DRAFT on a PDF…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => pickSingle("protect")}>
            <Lock className="h-3.5 w-3.5 mr-2" />
            Password protect a PDF…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={mergeInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleMerge(e.target.files)}
      />
      <input
        ref={singleInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleSinglePicked(e.target.files)}
      />

      <Dialog open={action === "watermark" && pendingFile !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stamp PDF</DialogTitle>
            <DialogDescription>Adds a large diagonal watermark to every page of {pendingFile?.name}.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="wm-text">Watermark text</Label>
            <Input
              id="wm-text"
              value={watermarkText}
              onChange={(e) => setWatermarkText(e.target.value)}
              placeholder="DRAFT"
              maxLength={40}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={busy}>Cancel</Button>
            <Button onClick={runWatermark} disabled={busy || !watermarkText.trim()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
              Stamp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={action === "protect" && pendingFile !== null} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Password protect PDF</DialogTitle>
            <DialogDescription>Encrypts {pendingFile?.name} so it can only be opened with this password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pw-text">Password</Label>
            <Input
              id="pw-text"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={busy}>Cancel</Button>
            <Button onClick={runProtect} disabled={busy || !password.trim()}>
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
              Protect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
