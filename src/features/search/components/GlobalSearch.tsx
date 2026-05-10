import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, FileBarChart, FileText, FileSearch, Plus, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useGlobalSearch, SearchResult } from "../hooks/useGlobalSearch";
import { useLocalStorage } from "@/hooks/useLocalStorage";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ICONS = {
  solicitation: FileSearch,
  client: Building2,
  report: FileBarChart,
  document: FileText,
} as const;

export function GlobalSearch({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useLocalStorage<SearchResult[]>("recent-searches", []);
  const { data: results = [], isFetching } = useGlobalSearch(query);

  const go = (href: string, item?: SearchResult) => {
    if (item) {
      setRecent((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 5));
    }
    onOpenChange(false);
    setQuery("");
    navigate(href);
  };

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search solicitations, clients, reports..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isFetching ? "Searching..." : query.length > 1 ? "No results found." : "Start typing to search."}
        </CommandEmpty>

        {query.length <= 1 && recent.length > 0 && (
          <CommandGroup heading="Recent">
            {recent.map((r) => {
              const Icon = ICONS[r.type];
              return (
                <CommandItem key={`recent-${r.id}`} onSelect={() => go(r.href, r)} value={`recent-${r.title}`}>
                  <Icon className="mr-2 h-4 w-4" />
                  <span className="flex-1 truncate">{r.title}</span>
                  <span className="text-xs text-muted-foreground capitalize">{r.type}</span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {query.length <= 1 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Quick actions">
              <CommandItem onSelect={() => go("/solicitations")} value="new solicitation">
                <Plus className="mr-2 h-4 w-4" /> New solicitation
              </CommandItem>
              <CommandItem onSelect={() => go("/clients")} value="new client">
                <Building2 className="mr-2 h-4 w-4" /> Manage clients
              </CommandItem>
              <CommandItem onSelect={() => go("/reports")} value="reports">
                <FileBarChart className="mr-2 h-4 w-4" /> Reports
              </CommandItem>
            </CommandGroup>
          </>
        )}

        {Object.entries(grouped).map(([type, items]) => (
          <CommandGroup key={type} heading={`${type.charAt(0).toUpperCase()}${type.slice(1)}s`}>
            {items.map((item) => {
              const Icon = ICONS[item.type];
              return (
                <CommandItem key={item.id} onSelect={() => go(item.href, item)} value={`${item.type}-${item.title}`}>
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{item.title}</div>
                    {item.subtitle && (
                      <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export default GlobalSearch;
