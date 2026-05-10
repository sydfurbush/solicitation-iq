import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Download, Loader2, Search } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadDocument, getSignedUrl, type DocumentRow } from "../hooks/useDocuments";
import { ProcessingStatus } from "./ProcessingStatus";
import { DocumentSectionsTree } from "./DocumentSectionsTree";
import { ExtractedEntitiesPanel } from "./ExtractedEntitiesPanel";

type Props = {
  document: DocumentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DocumentViewer({ document: doc, open, onOpenChange }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("content");
  const [highlight, setHighlight] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!doc || !open) {
      setUrl(null);
      setHighlight("");
      setSearch("");
      setTab("content");
      return;
    }
    setLoading(true);
    getSignedUrl(doc.file_path, 60 * 30)
      .then(setUrl)
      .finally(() => setLoading(false));
  }, [doc, open]);

  const isPdf = doc?.file_type?.includes("pdf") || doc?.file_name.toLowerCase().endsWith(".pdf");
  const isProcessing = doc?.status === "uploading" || doc?.status === "processing";

  const highlighted = useMemo(() => {
    const text = doc?.extracted_text ?? "";
    const term = (highlight || search).trim();
    if (!term || term.length < 2) return text;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(
      new RegExp(`(${escaped})`, "gi"),
      `<<<MARK>>>$1<<<ENDMARK>>>`
    );
  }, [doc?.extracted_text, highlight, search]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl flex flex-col p-0">
        <SheetHeader className="p-6 pb-3">
          <SheetTitle className="truncate">{doc?.file_name ?? "Document"}</SheetTitle>
          {doc && (
            <SheetDescription>
              {(doc.document_type ?? "document").replace(/_/g, " ")} · v{doc.version ?? 1}
              {doc.total_pages ? ` · ${doc.total_pages} pages` : ""}
            </SheetDescription>
          )}
        </SheetHeader>

        {doc && (
          <div className="px-6 pb-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => downloadDocument(doc)}>
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

        {doc && isProcessing && (
          <div className="px-6 pb-3">
            <ProcessingStatus documentId={doc.id} />
          </div>
        )}

        <Separator />

        <div className="flex-1 min-h-0 flex flex-col">
          <Tabs value={tab} onValueChange={setTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-3 self-start">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="sections">Sections</TabsTrigger>
              <TabsTrigger value="entities">Entities</TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="flex-1 min-h-0 mt-2 mx-0">
              {loading && (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
                </div>
              )}
              {!loading && (
                <div className="h-full flex flex-col">
                  <div className="px-6 pb-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search in document text…"
                        className="pl-9 h-9"
                      />
                    </div>
                  </div>
                  {url && isPdf && !doc?.extracted_text ? (
                    <iframe src={url} title={doc?.file_name} className="w-full flex-1 border-0" />
                  ) : (
                    <ScrollArea className="flex-1 px-6 pb-6">
                      {doc?.extracted_text ? (
                        <HighlightedText html={highlighted} />
                      ) : (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                          No extracted text yet.{" "}
                          {url && (
                            <a className="underline" href={url} target="_blank" rel="noopener noreferrer">
                              Open the original
                            </a>
                          )}
                        </p>
                      )}
                    </ScrollArea>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sections" className="flex-1 min-h-0 mt-2">
              <ScrollArea className="h-full px-6 pb-6">
                {doc && (
                  <DocumentSectionsTree
                    documentId={doc.id}
                    onSectionClick={(s) => {
                      setHighlight(s.section_title ?? "");
                      setTab("content");
                    }}
                  />
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="entities" className="flex-1 min-h-0 mt-2">
              <ScrollArea className="h-full px-6 pb-6">
                {doc && (
                  <ExtractedEntitiesPanel
                    documentId={doc.id}
                    onEntityClick={(e) => {
                      setHighlight(e.entity_value);
                      setTab("content");
                    }}
                  />
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HighlightedText({ html }: { html: string }) {
  // Convert sentinel markers to <mark> tags safely (we only inserted these markers around the search term)
  const parts = html.split(/<<<MARK>>>|<<<ENDMARK>>>/);
  return (
    <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-amber-200 dark:bg-amber-500/40 rounded px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </pre>
  );
}
