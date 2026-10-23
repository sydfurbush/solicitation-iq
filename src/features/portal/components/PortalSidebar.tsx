import { useState } from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, FileText, FileBarChart, LifeBuoy, Menu, FolderUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/portal", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/portal/solicitations", label: "Solicitations", icon: FileText },
  { to: "/portal/documents", label: "Company Documents", icon: FolderUp },
  { to: "/portal/reports", label: "Reports", icon: FileBarChart },
  { to: "/portal/support", label: "Support", icon: LifeBuoy },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex-1 p-3 space-y-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )
          }
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function PortalSidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="hidden md:flex w-60 border-r bg-background flex-col">
        <div className="h-16 flex items-center px-5 border-b font-semibold">Portal</div>
        <NavList />
      </aside>
      <div className="md:hidden absolute top-3 left-3 z-30">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-60">
            <div className="h-16 flex items-center px-5 border-b font-semibold">Portal</div>
            <NavList onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
