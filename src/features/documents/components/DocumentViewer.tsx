import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink, Download, Loader2, Search, X } from "lucide-react";
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
  const [activeIdx, setActiveIdx] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

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
  const term = (highlight || search).trim();
  const hasExtractedText = !!doc?.extracted_text;
  const showIframe = !!url && isPdf && !hasExtractedText;

  // Reset active match on term change
  useEffect(() => {
    setActiveIdx(0);
  }, [term]);

  // Scroll active match into view
  useEffect(() => {
    if (matchCount === 0) return;
    const root = scrollRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`mark[data-match-index="${activeIdx}"]`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIdx, matchCount, term]);

  const goNext = () => {
    if (matchCount === 0) return;
    setActiveIdx((i) => (i + 1) % matchCount);
  };
  const goPrev = () => {
    if (matchCount === 0) return;
    setActiveIdx((i) => (i - 1 + matchCount) % matchCount);
  };

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
                  {hasExtractedText && (
                    <div className="px-6 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                if (e.shiftKey) goPrev();
                                else goNext();
                              } else if (e.key === "Escape") {
                                setSearch("");
                                setHighlight("");
                              }
                            }}
                            placeholder="Search in document text…"
                            className="pl-9 pr-9 h-9"
                          />
                          {(search || highlight) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearch("");
                                setHighlight("");
                              }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              aria-label="Clear search"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {term.length >= 2 && (
                          <>
                            <span className="text-xs text-muted-foreground tabular-nums min-w-[64px] text-right">
                              {matchCount === 0 ? "No matches" : `${activeIdx + 1} of ${matchCount}`}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-9 w-9"
                              onClick={goPrev}
                              disabled={matchCount === 0}
                              aria-label="Previous match"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-9 w-9"
                              onClick={goNext}
                              disabled={matchCount === 0}
                              aria-label="Next match"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {showIframe ? (
                    <iframe src={url!} title={doc?.file_name} className="w-full flex-1 border-0" />
                  ) : (
                    <div ref={scrollRef} className="flex-1 overflow-auto px-6 pb-6">
                      {hasExtractedText ? (
                        <HighlightedText
                          text={doc!.extracted_text!}
                          term={term}
                          activeIdx={activeIdx}
                          onMatchCount={setMatchCount}
                        />
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
                    </div>
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

function HighlightedText({
  text,
  term,
  activeIdx,
  onMatchCount,
}: {
  text: string;
  term: string;
  activeIdx: number;
  onMatchCount: (n: number) => void;
}) {
  const segments = useMemo(() => {
    if (!term || term.length < 2) return { parts: [text], matches: 0 };
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(re);
    // odd indices are matches
    const matches = Math.floor(parts.length / 2);
    return { parts, matches };
  }, [text, term]);

  useEffect(() => {
    onMatchCount(segments.matches);
  }, [segments.matches, onMatchCount]);

  let matchIdx = -1;
  return (
    <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
      {segments.parts.map((p, i) => {
        if (i % 2 === 1) {
          matchIdx += 1;
          const isActive = matchIdx === activeIdx;
          return (
            <mark
              key={i}
              data-match-index={matchIdx}
              className={
                isActive
                  ? "bg-amber-400 dark:bg-amber-500/70 rounded px-0.5 ring-2 ring-amber-500"
                  : "bg-amber-200 dark:bg-amber-500/40 rounded px-0.5"
              }
            >
              {p}
            </mark>
          );
        }
        return <span key={i}>{p}</span>;
      })}
    </pre>
  );
}
