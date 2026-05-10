import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Search,
  Building2,
  User,
  ShieldCheck,
  CheckSquare,
  DollarSign,
  AlertOctagon,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type EntityRow = {
  id: string;
  entity_type: string;
  entity_value: string;
  context_snippet: string | null;
  page_number: number | null;
  section_reference: string | null;
  confidence_score: number | null;
};

const TYPE_META: Record<string, { label: string; icon: typeof Calendar; tone: string }> = {
  requirement: { label: "Requirements", icon: CheckSquare, tone: "text-primary" },
  date: { label: "Dates", icon: Calendar, tone: "text-blue-500" },
  deadline: { label: "Deadlines", icon: AlertOctagon, tone: "text-amber-600" },
  dollar_amount: { label: "Dollar amounts", icon: DollarSign, tone: "text-emerald-600" },
  organization: { label: "Organizations", icon: Building2, tone: "text-indigo-500" },
  person: { label: "People", icon: User, tone: "text-pink-500" },
  certification: { label: "Certifications", icon: ShieldCheck, tone: "text-purple-500" },
  compliance: { label: "Compliance", icon: ShieldCheck, tone: "text-rose-500" },
};

export function ExtractedEntitiesPanel({
  documentId,
  onEntityClick,
}: {
  documentId: string;
  onEntityClick?: (entity: EntityRow) => void;
}) {
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["entities", documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("extracted_entities")
        .select("id, entity_type, entity_value, context_snippet, page_number, section_reference, confidence_score")
        .eq("document_id", documentId)
        .order("entity_type", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EntityRow[];
    },
  });

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return (data ?? []).filter(
      (e) =>
        (filterType === "all" || e.entity_type === filterType) &&
        (term === "" ||
          e.entity_value.toLowerCase().includes(term) ||
          (e.context_snippet ?? "").toLowerCase().includes(term))
    );
  }, [data, filterType, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, EntityRow[]>();
    filtered.forEach((e) => {
      if (!map.has(e.entity_type)) map.set(e.entity_type, []);
      map.get(e.entity_type)!.push(e);
    });
    return Array.from(map.entries());
  }, [filtered]);

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (!data || data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No entities have been extracted yet.
      </p>
    );
  }

  const types = Array.from(new Set(data.map((e) => e.entity_type)));

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities…"
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_META[t]?.label ?? t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Accordion type="multiple" defaultValue={grouped.map(([t]) => t)} className="space-y-2">
        {grouped.map(([type, entities]) => {
          const meta = TYPE_META[type] ?? {
            label: type,
            icon: CheckSquare,
            tone: "text-muted-foreground",
          };
          const Icon = meta.icon;
          return (
            <AccordionItem key={type} value={type} className="border rounded-md px-3">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Icon className={cn("h-4 w-4", meta.tone)} />
                  <span className="font-medium">{meta.label}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {entities.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {entities.map((e) => (
                    <li
                      key={e.id}
                      className="rounded-md border p-2.5 text-sm hover:bg-accent/40 cursor-pointer transition-colors"
                      onClick={() => onEntityClick?.(e)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium break-words">{e.entity_value}</p>
                        <ConfidenceDot score={e.confidence_score} />
                      </div>
                      {e.context_snippet && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          “{e.context_snippet}”
                        </p>
                      )}
                      {(e.page_number != null || e.section_reference) && (
                        <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                          {e.page_number != null && <span>p. {e.page_number}</span>}
                          {e.section_reference && (
                            <>
                              <ChevronRight className="h-3 w-3" />
                              <span>{e.section_reference}</span>
                            </>
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function ConfidenceDot({ score }: { score: number | null }) {
  if (score == null) return null;
  const tone =
    score >= 0.8 ? "bg-emerald-500" : score >= 0.5 ? "bg-amber-500" : "bg-muted-foreground";
  return (
    <span
      title={`Confidence: ${Math.round(score * 100)}%`}
      className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5", tone)}
    />
  );
}
