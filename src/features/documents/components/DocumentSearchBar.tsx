import { useState, useRef, useEffect } from "react";
import { FileText, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDocumentSearch, type SearchResult } from "../hooks/useDocumentSearch";

type Props = {
  solicitationId: string;
  onResultClick?: (result: SearchResult) => void;
};

export function DocumentSearchBar({ solicitationId, onResultClick }: Props) {
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data = [], grouped, isFetching } = useDocumentSearch(solicitationId, term);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const flat = data;

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((i) => Math.min(i + 1, flat.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((i) => Math.max(0, i - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const r = flat[activeIdx];
              if (r) {
                onResultClick?.(r);
                setOpen(false);
              }
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder="Search across all documents…"
          className="pl-9 pr-9"
        />
        {term && (
          <button
            type="button"
            onClick={() => {
              setTerm("");
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isFetching && (
          <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && term.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full max-h-96 overflow-auto rounded-md border bg-popover shadow-md">
          {flat.length === 0 && !isFetching && (
            <p className="text-sm text-muted-foreground px-3 py-4 text-center">No results.</p>
          )}
          {grouped.map((g) => (
            <div key={g.documentId}>
              <div className="px-3 py-1.5 bg-muted/50 text-xs font-medium flex items-center gap-2">
                <FileText className="h-3 w-3" /> {g.name}
                <Badge variant="secondary" className="text-[10px]">
                  {g.results.length}
                </Badge>
              </div>
              {g.results.map((r) => {
                const idx = flat.indexOf(r);
                return (
                  <button
                    key={`${r.section_id ?? "_"}-${idx}`}
                    type="button"
                    onClick={() => {
                      onResultClick?.(r);
                      setOpen(false);
                    }}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      "w-full text-left px-3 py-2 hover:bg-accent text-xs space-y-0.5 border-b",
                      activeIdx === idx && "bg-accent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">
                        {r.section_title ?? "Untitled section"}
                      </span>
                      {r.page_number != null && (
                        <span className="text-muted-foreground">p. {r.page_number}</span>
                      )}
                    </div>
                    <p
                      className="text-muted-foreground line-clamp-2 [&_mark]:bg-amber-200 dark:[&_mark]:bg-amber-500/40 [&_mark]:rounded [&_mark]:px-0.5"
                      dangerouslySetInnerHTML={{ __html: r.snippet }}
                    />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
