import { Link, useNavigate } from "react-router-dom";
import { MoreVertical, ExternalLink, Mail, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ClientWithStats } from "../hooks/useClients";

interface Props {
  client: ClientWithStats;
  onEdit: (client: ClientWithStats) => void;
  onDelete: (client: ClientWithStats) => void;
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

export function ClientCard({ client, onEdit, onDelete }: Props) {
  const navigate = useNavigate();
  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
      onClick={() => navigate(`/clients/${client.id}`)}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Avatar className="h-12 w-12">
              {client.logo_url ? <AvatarImage src={client.logo_url} alt={client.name} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                {initials(client.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="font-semibold truncate">{client.name}</h3>
              {client.industry && (
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> {client.industry}
                </p>
              )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 -mr-1">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onEdit(client)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/solicitations?client=${client.id}`)}>
                View Solicitations
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(client)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {client.active_solicitations_count} active{" "}
            {client.active_solicitations_count === 1 ? "solicitation" : "solicitations"}
          </Badge>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          {client.primary_contact_name && (
            <p className="truncate">{client.primary_contact_name}</p>
          )}
          {client.primary_contact_email && (
            <p className="truncate flex items-center gap-1">
              <Mail className="h-3 w-3" /> {client.primary_contact_email}
            </p>
          )}
          {client.website && (
            <Link
              to={client.website.startsWith("http") ? client.website : `https://${client.website}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline truncate flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" /> {client.website}
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
