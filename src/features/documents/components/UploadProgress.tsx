import { create } from "zustand";
import { useState } from "react";
import { ChevronDown, ChevronUp, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type GlobalUpload = {
  id: string;
  name: string;
  status: "uploading" | "complete" | "failed";
  progress: number;
  error?: string;
};

type UploadStore = {
  uploads: GlobalUpload[];
  add: (u: GlobalUpload) => void;
  update: (id: string, patch: Partial<GlobalUpload>) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
};

export const useUploadStore = create<UploadStore>((set) => ({
  uploads: [],
  add: (u) => set((s) => ({ uploads: [u, ...s.uploads] })),
  update: (id, patch) =>
    set((s) => ({
      uploads: s.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    })),
  remove: (id) => set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) })),
  clearFinished: () =>
    set((s) => ({ uploads: s.uploads.filter((u) => u.status === "uploading") })),
}));

export function UploadProgress() {
  const uploads = useUploadStore((s) => s.uploads);
  const clearFinished = useUploadStore((s) => s.clearFinished);
  const [collapsed, setCollapsed] = useState(false);

  if (uploads.length === 0) return null;

  const inFlight = uploads.filter((u) => u.status === "uploading");
  const total = uploads.length;
  const done = uploads.filter((u) => u.status !== "uploading").length;
  const overall = total === 0 ? 0 : (done / total) * 100;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-card shadow-lg">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-b"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="text-sm font-medium">
          {inFlight.length > 0
            ? `Uploading ${done + 1} of ${total} files`
            : `${done} upload${done === 1 ? "" : "s"} complete`}
        </span>
        {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      <div className="px-4 py-2">
        <Progress value={overall} className="h-1.5" />
      </div>
      {!collapsed && (
        <ul className="max-h-64 overflow-auto px-2 pb-2 space-y-1">
          {uploads.map((u) => (
            <li
              key={u.id}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                u.status === "failed" && "bg-destructive/5"
              )}
            >
              {u.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />}
              {u.status === "complete" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
              {u.status === "failed" && <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              <span className="flex-1 truncate">{u.name}</span>
              {u.status === "uploading" && (
                <span className="text-muted-foreground">{u.progress}%</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {inFlight.length === 0 && (
        <div className="border-t px-3 py-2 flex justify-end">
          <Button size="sm" variant="ghost" onClick={clearFinished}>
            <X className="mr-1 h-3.5 w-3.5" /> Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}
