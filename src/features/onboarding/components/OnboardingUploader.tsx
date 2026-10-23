import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { useQueryClient } from "@tanstack/react-query";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { ONBOARDING_ACCEPT, ONBOARDING_EXTENSIONS, validateOnboardingFile } from "../lib/onboardingFiles";
import { runTriage, uploadOnboardingFile } from "../hooks/useOnboarding";

export type ReceivedMeta = { via: "email" | "other"; from: string | null; on: string | null };

export function OnboardingUploader({ clientId, kind, received, children }: {
  clientId: string; kind: "staff" | "client"; received?: ReceivedMeta; children?: React.ReactNode;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["onboarding-docs", clientId] });
    qc.invalidateQueries({ queryKey: ["onboarding-triage", clientId] });
  };

  const onDrop = async (files: File[]) => {
    const valid = files.filter((f) => {
      const err = validateOnboardingFile(f.name, f.size);
      if (err) toast({ title: f.name, description: err, variant: "destructive" });
      return !err;
    });
    if (!valid.length) return;
    setBusy((b) => b + valid.length);
    // Upload in parallel…
    const results = await Promise.allSettled(valid.map((f) => uploadOnboardingFile(clientId, f, kind, received)));
    setBusy((b) => b - valid.length);
    results.forEach((r, i) => {
      if (r.status === "rejected") toast({ title: "Upload failed", description: valid[i].name, variant: "destructive" });
    });
    refresh();
    // …then triage one file at a time.
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      try { await runTriage(r.value); } catch { /* status row records the failure */ }
      refresh();
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop, accept: ONBOARDING_ACCEPT, noClick: true, multiple: true,
  });

  return (
    <div className="space-y-3">
    {children}
    <div
      {...getRootProps()}
      className={cn("border-2 border-dashed rounded-lg p-6 text-center transition-colors",
        isDragActive ? "border-primary bg-primary/5" : "border-border bg-muted/30")}
    >
      <input {...getInputProps()} />
      <UploadCloud className="h-8 w-8 mx-auto text-primary" />
      <p className="font-medium mt-2">{isDragActive ? "Drop the files here" : received?.via === "email" ? "Drag in the email attachments here" : "Drag and drop files here"}</p>
      <p className="text-xs text-muted-foreground mt-1">Up to 25 MB each · {ONBOARDING_EXTENSIONS.join(", ")}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={open} disabled={busy > 0}>
        {busy > 0 ? `Uploading ${busy}…` : "Browse files"}
      </Button>
    </div>
    </div>
  );
}
