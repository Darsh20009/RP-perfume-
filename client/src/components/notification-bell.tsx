import { Bell, Trash2, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotifications, type AppNotification } from "@/hooks/use-notifications";
import { useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const typeColors: Record<string, string> = {
  success: "bg-green-50 border-l-green-400",
  error: "bg-red-50 border-l-red-400",
  warning: "bg-yellow-50 border-l-yellow-400",
  info: "bg-blue-50 border-l-blue-400",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "الآن";
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}

function NotifItem({
  notif,
  onRead,
  onDelete,
}: {
  notif: AppNotification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [, setLocation] = useLocation();

  const handleClick = () => {
    if (!notif.isRead) onRead(notif._id);
    if (notif.link) setLocation(notif.link);
  };

  return (
    <div
      className={`relative flex gap-3 px-3 py-3 border-l-4 transition-all cursor-pointer hover:brightness-95 ${
        typeColors[notif.type] || typeColors.info
      } ${notif.isRead ? "opacity-60" : ""}`}
      onClick={handleClick}
    >
      <span className="text-lg mt-0.5 select-none">{notif.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-[11px] font-black leading-tight text-black truncate">{notif.title}</p>
          {!notif.isRead && (
            <span className="h-2 w-2 rounded-full bg-black shrink-0 mt-1" />
          )}
        </div>
        <p className="text-[10px] text-black/60 leading-snug mt-0.5 line-clamp-2">{notif.body}</p>
        <p className="text-[9px] text-black/30 mt-1 font-mono">{timeAgo(notif.createdAt)}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 rounded-none absolute top-2 left-2"
        onClick={(e) => { e.stopPropagation(); onDelete(notif._id); }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotif } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative no-default-hover-elevate hover:text-primary h-11 w-11 active:scale-95 transition-transform"
        >
          <Bell className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-black text-[9px] font-black text-white flex items-center justify-center shadow-md animate-bounce">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 p-0 rounded-none border-black/5 shadow-2xl bg-white animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/5 bg-black/[0.02]">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-black/40" />
            <span className="text-[10px] font-black uppercase tracking-widest">الإشعارات</span>
            {unreadCount > 0 && (
              <Badge className="h-5 px-1.5 text-[9px] font-black rounded-full bg-black text-white">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              className="h-7 px-2 text-[9px] font-black uppercase tracking-wider gap-1 rounded-none hover:bg-black hover:text-white"
            >
              <CheckCheck className="h-3 w-3" />
              قراءة الكل
            </Button>
          )}
        </div>

        {/* List */}
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-black/30">
              <Bell className="h-8 w-8" />
              <p className="text-[10px] font-black uppercase tracking-widest">لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-black/5">
              {notifications.map((n) => (
                <NotifItem
                  key={n._id}
                  notif={n}
                  onRead={markRead}
                  onDelete={deleteNotif}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
