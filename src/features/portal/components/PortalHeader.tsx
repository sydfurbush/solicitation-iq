import { Link, useNavigate } from "react-router-dom";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useClientUser } from "../hooks/useClientUser";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { NotificationCenter } from "./NotificationCenter";

export function PortalHeader() {
  const { client, clientUser } = useClientUser();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const initials =
    clientUser?.full_name
      ?.split(" ")
      .map((p: string) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? clientUser?.email?.[0]?.toUpperCase() ?? "C";

  const handleLogout = async () => {
    await signOut();
    navigate("/portal/login", { replace: true });
  };

  return (
    <header className="h-16 border-b bg-background px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {client?.logo_url ? (
          <img src={client.logo_url} alt={client.name} className="h-9 w-9 rounded object-cover" />
        ) : (
          <div className="h-9 w-9 rounded bg-primary/10 text-primary grid place-items-center font-semibold">
            {client?.name?.[0]?.toUpperCase() ?? "C"}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-semibold truncate">{client?.name ?? "Client Portal"}</div>
          <div className="text-xs text-muted-foreground">Client Portal</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <NotificationCenter />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 px-2 gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={clientUser?.avatar_url ?? undefined} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="text-sm hidden sm:inline">
                {clientUser?.full_name ?? clientUser?.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{clientUser?.email}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/portal/profile">
                <User className="mr-2 h-4 w-4" /> Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
