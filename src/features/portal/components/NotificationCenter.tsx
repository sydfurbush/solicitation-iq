import { Bell, CheckCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useClientNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "../hooks/useClientNotifications";
import { cn } from "@/lib/utils";

export function NotificationCenter() {
  const { data: notifications = [], unreadCount } = useClientNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 p-0 grid place-items-center text-[10px]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark all
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <ul>
              {notifications.map((n: any) => {
                const body = (
                  <div
                    className={cn(
                      "p-3 border-b hover:bg-muted/50 transition-colors cursor-pointer",
                      !n.is_read && "bg-primary/5",
                    )}
                    onClick={() => !n.is_read && markRead.mutate(n.id)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{n.title}</div>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary mt-1.5" />}
                    </div>
                    {n.message && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {n.message}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link_url ? <Link to={n.link_url}>{body}</Link> : body}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
