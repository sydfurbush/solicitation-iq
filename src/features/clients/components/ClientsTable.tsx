import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpDown, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ClientWithStats } from "../hooks/useClients";

type SortKey = "name" | "industry" | "active" | "contact" | "created";

interface Props {
  clients: ClientWithStats[];
  onEdit: (c: ClientWithStats) => void;
  onDelete: (c: ClientWithStats) => void;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ClientsTable({ clients, onEdit, onDelete }: Props) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const accessor = (c: ClientWithStats) => {
      switch (sortKey) {
        case "name": return c.name?.toLowerCase() ?? "";
        case "industry": return c.industry?.toLowerCase() ?? "";
        case "active": return c.active_solicitations_count;
        case "contact": return c.primary_contact_name?.toLowerCase() ?? "";
        case "created": return c.created_at ?? "";
      }
    };
    return [...clients].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [clients, sortKey, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  };

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <Button variant="ghost" size="sm" className="-ml-3 h-8" onClick={() => toggleSort(k)}>
      {children}
      <ArrowUpDown className="ml-2 h-3 w-3" />
    </Button>
  );

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[60px]"></TableHead>
            <TableHead><SortBtn k="name">Name</SortBtn></TableHead>
            <TableHead><SortBtn k="industry">Industry</SortBtn></TableHead>
            <TableHead><SortBtn k="active">Active</SortBtn></TableHead>
            <TableHead><SortBtn k="contact">Primary contact</SortBtn></TableHead>
            <TableHead><SortBtn k="created">Created</SortBtn></TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((c) => (
            <TableRow
              key={c.id}
              className="cursor-pointer"
              onClick={() => navigate(`/clients/${c.id}`)}
            >
              <TableCell>
                <Avatar className="h-9 w-9">
                  {c.logo_url ? <AvatarImage src={c.logo_url} alt={c.name} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials(c.name)}
                  </AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-muted-foreground">{c.industry ?? "—"}</TableCell>
              <TableCell>
                <Badge variant="secondary">{c.active_solicitations_count}</Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {c.primary_contact_name ? (
                  <div className="flex flex-col">
                    <span>{c.primary_contact_name}</span>
                    {c.primary_contact_email && (
                      <span className="text-xs">{c.primary_contact_email}</span>
                    )}
                  </div>
                ) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {c.created_at ? format(new Date(c.created_at), "MMM d, yyyy") : "—"}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(c)}>Edit</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate(`/solicitations?client=${c.id}`)}>
                      View Solicitations
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => onDelete(c)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
