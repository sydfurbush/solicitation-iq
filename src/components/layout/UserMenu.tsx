import { LogOut, Settings as SettingsIcon, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useUser } from "@/features/auth/hooks/useUser";
import { toast } from "@/hooks/use-toast";

function initials(name?: string | null, email?: string | null) {
  const src = name?.trim() || email?.split("@")[0] || "U";
  return src
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function UserMenu() {
  const navigate = useNavigate();
  const { signOut, user: authUser } = useAuth();
  const { user } = useUser();

  const displayName = user?.full_name || authUser?.email || "User";
  const email = user?.email || authUser?.email || "";

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({ title: "Sign out failed", description: error.message, variant: "destructive" });
      return;
    }
    navigate("/login", { replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 w-9 rounded-full p-0">
          <Avatar className="h-9 w-9">
            {user?.avatar_url ? <AvatarImage src={user.avatar_url} alt={displayName} /> : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials(user?.full_name, email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{displayName}</span>
            <span className="text-xs text-muted-foreground truncate">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <User className="mr-2 h-4 w-4" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/settings")}>
          <SettingsIcon className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
