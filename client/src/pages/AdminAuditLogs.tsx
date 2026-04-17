import { useQuery } from "@tanstack/react-query";
import { ActivityLog, User } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User as UserIcon, Clock, Activity, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function AdminAuditLogs() {
  const { data: logs, isLoading: logsLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/admin/audit-logs"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit-logs");
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    }
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    }
  });

  if (logsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-black uppercase tracking-tight">سجل العمليات (Audit Log)</h2>
        <Badge variant="outline" className="rounded-none font-bold">
          {logs?.length || 0} عملية مسجلة
        </Badge>
      </div>

      <div className="space-y-4">
        {(!logs || logs.length === 0) ? (
          <Card className="rounded-none border-dashed border-2">
            <CardContent className="p-12 text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-xs">لا توجد عمليات مسجلة حالياً</p>
            </CardContent>
          </Card>
        ) : (
          logs.map((log) => {
            const user = users?.find(u => u.id === log.employeeId);
            return (
              <Card key={log.id} className="rounded-none border-black/5 hover-elevate transition-all">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-black/5 flex items-center justify-center rounded-none">
                        <Activity className="h-4 w-4 text-black" />
                      </div>
                      <div className="text-right">
                        <p className="font-black text-xs uppercase tracking-tight">
                          {log.action}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                          <UserIcon className="h-3 w-3" />
                          {user?.name || "نظام"} ({user?.role || "System"})
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(log.createdAt), "PPP p", { locale: ar })}
                      </div>
                      <Badge variant="secondary" className="rounded-none text-[8px] font-black uppercase tracking-tighter">
                        {log.targetType}: {log.targetId?.slice(-6).toUpperCase() || "N/A"}
                      </Badge>
                    </div>
                  </div>

                  {log.details && (
                    <div className="mt-3 p-3 bg-secondary/20 rounded-none border-r-2 border-black">
                      <p className="text-[9px] font-black text-black/40 mb-1 uppercase tracking-widest">التفاصيل:</p>
                      <pre className="text-[10px] font-mono overflow-x-auto whitespace-pre-wrap">
                        {log.details}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
