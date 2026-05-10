import { useCallback } from "react";
import { toast } from "sonner";

type Row = Record<string, unknown>;

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useExport() {
  const exportToCSV = useCallback((data: Row[], filename: string) => {
    if (!data?.length) {
      toast.error("Nothing to export");
      return;
    }
    const headers = Array.from(
      data.reduce<Set<string>>((acc, row) => {
        Object.keys(row).forEach((k) => acc.add(k));
        return acc;
      }, new Set()),
    );
    const lines = [
      headers.join(","),
      ...data.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
    ];
    downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
    toast.success("Export ready");
  }, []);

  const exportToJSON = useCallback((data: unknown, filename: string) => {
    downloadBlob(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      `${filename}.json`,
    );
    toast.success("Export ready");
  }, []);

  /** Print-to-PDF via the browser. Caller may pass selector to print a section. */
  const exportToPDF = useCallback((selector?: string) => {
    if (selector) {
      const el = document.querySelector(selector);
      if (!el) {
        toast.error("Nothing to print");
        return;
      }
    }
    window.print();
  }, []);

  return { exportToCSV, exportToJSON, exportToPDF };
}

export default useExport;
