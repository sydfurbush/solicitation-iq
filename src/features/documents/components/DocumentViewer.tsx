import { useEffect, useState } from "react";
import { ExternalLink, Download, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { downloadDocument, getSignedUrl, type DocumentRow } from "../hooks/useDocuments";

type Props = {
  document: DocumentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DocumentViewer({ document: doc, open, onOpenChange }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!doc || !open) {
      setUrl(null);
      return;
    }
    setLoading(true);
    getSignedUrl(doc.file_path, 60 * 30)
      .then(setUrl)
      .finally(() => setLoading(false));
  }, [doc, open]);

  const isPdf = doc?.file_type?.includes("pdf") || doc?.file_name.toLowerCase().endsWith(".pdf");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="p-6 pb-3">
          <SheetTitle className="truncate">{doc?.file_name ?? "Document"}</SheetTitle>
          {doc && (
            <SheetDescription>
              {doc.document_type ? doc.document_type.replace(/_/g, " ") : "Document"} · v{doc.version ?? 1}
            </SheetDescription>
          )}
        </SheetHeader>
        {doc && (
          <div className="flex items-center gap-2 px-6 pb-3">
            <Button size="sm" variant="outline" onClick={() => doc && downloadDocument(doc)}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
            {url && (
              <Button size="sm" variant="outline" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> Open in new tab
                </a>
              </Button>
            )}
          </div>
        )}
        <Separator />

        <div className="flex-1 min-h-0">
          {loading && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          )}
          {!loading && url && isPdf && (
            <iframe src={url} title={doc?.file_name} className="w-full h-full border-0" />
          )}
          {!loading && url && !isPdf && (
            <ScrollArea className="h-full p-6">
              {doc?.extracted_text ? (
                <pre className="whitespace-pre-wrap text-sm font-mono">{doc.extracted_text}</pre>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Preview not available for this file type. Use Download or Open in new tab.
                </p>
              )}
            </ScrollArea>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
