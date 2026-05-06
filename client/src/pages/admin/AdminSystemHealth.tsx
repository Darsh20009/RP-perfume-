import { useQuery } from "@tanstack/react-query";
import { Loader2, Activity, Database, Server, Mail, Clock, Cpu, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

function pct(used: number, limit: number) {
  return Math.min(100, Math.round((used / limit) * 100));
}

function statusColor(p: number) {
  if (p < 60) return { ring: "stroke-emerald-500", bg: "bg-emerald-500", text: "text-emerald-600", label: "سليم" };
  if (p < 85) return { ring: "stroke-amber-400", bg: "bg-amber-400", text: "text-amber-600", label: "تنبيه" };
  return { ring: "stroke-red-500", bg: "bg-red-500", text: "text-red-600", label: "حرج" };
}

function CircleGauge({ pct: p, label, sublabel, icon: Icon }: { pct: number; label: string; sublabel: string; icon: any }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (p / 100) * circ;
  const col = statusColor(p);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
          <circle
            cx="50" cy="50" r={r} fill="none"
            className={col.ring}
            strokeWidth="10"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className="h-4 w-4 text-slate-400 mb-0.5" />
          <span className="text-xl font-black text-slate-800">{p}%</span>
        </div>
      </div>
      <div className="text-center">
        <p className="font-black text-sm text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-400 font-bold mt-0.5">{sublabel}</p>
        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black ${col.text} bg-current/10`}
          style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}>
          <span className={col.text}>{col.label}</span>
        </span>
      </div>
    </div>
  );
}

function MetricBar({ label, used, limit, unit, icon: Icon, color = "bg-blue-500" }: {
  label: string; used: number; limit: number; unit: string; icon: any; color?: string;
}) {
  const p = pct(used, limit);
  const col = statusColor(p);
  return (
    <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
      <div className={`p-2.5 rounded-xl ${col.bg} bg-opacity-10`}>
        <Icon className={`h-5 w-5 ${col.text}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 mb-2">
          <span className="font-black text-sm text-slate-800">{label}</span>
          <span className="text-xs font-bold text-slate-400 shrink-0">
            {used.toLocaleString("ar-SA")} / {limit.toLocaleString("ar-SA")} {unit}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${col.bg} rounded-full transition-all duration-1000`}
            style={{ width: `${p}%` }}
          />
        </div>
        <p className="text-[10px] font-bold text-slate-400 mt-1">{p}% مستخدم</p>
      </div>
    </div>
  );
}

export default function AdminSystemHealth() {
  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ["/api/admin/system-health"],
    queryFn: async () => {
      const r = await fetch("/api/admin/system-health");
      if (!r.ok) throw new Error("فشل جلب بيانات الصحة");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-[#DFB369]" />
    </div>
  );

  const ai = data?.ai || { used: 0, limit: 25_000_000 };
  const db = data?.db || { usedMB: 0, limitMB: 512 };
  const hosting = data?.hosting || { uptimeHours: 0, limitHours: 750 };
  const email = data?.email || { sent: 0, limit: 1000 };
  const cron = data?.cron || { intervalMin: 1, jobsCompleted: 0, jobsFailed: 0 };
  const mongo = data?.mongo || { connected: false };

  const aiPct = pct(ai.used, ai.limit);
  const dbPct = pct(db.usedMB, db.limitMB);
  const hostingPct = pct(hosting.uptimeHours, hosting.limitHours);
  const emailPct = pct(email.sent, email.limit);

  const overallHealth = Math.round((aiPct + dbPct + hostingPct + emailPct) / 4);
  const overallCol = statusColor(overallHealth);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Activity className="h-6 w-6 text-emerald-600" />
            </div>
            صحة النظام
          </h2>
          <p className="text-sm text-slate-400 font-bold mt-1 pr-11">مراقبة الموارد والخدمات في الوقت الفعلي</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black hover:bg-slate-200 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {/* Overall status banner */}
      <div className={`p-5 rounded-2xl border-2 flex items-center gap-5 ${
        overallHealth < 60 ? "border-emerald-200 bg-emerald-50" :
        overallHealth < 85 ? "border-amber-200 bg-amber-50" :
        "border-red-200 bg-red-50"
      }`}>
        <div className="relative w-20 h-20 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="12" />
            <circle
              cx="50" cy="50" r="42" fill="none"
              className={overallCol.ring}
              strokeWidth="12"
              strokeDasharray={`${(overallHealth / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42 * (1 - overallHealth / 100)}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-black text-slate-800">{overallHealth}%</span>
          </div>
        </div>
        <div>
          <p className="font-black text-lg text-slate-800">الصحة العامة للنظام</p>
          <p className="text-sm text-slate-500 font-bold mt-1">
            {overallHealth < 60 ? "جميع الخدمات تعمل بكفاءة عالية" :
             overallHealth < 85 ? "بعض الخدمات تقترب من الحد الأقصى" :
             "تنبيه: بعض الخدمات تتجاوز الحد الأمن"}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-[11px] font-black text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              قاعدة البيانات {mongo.connected ? "متصلة" : "منقطعة"}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-black text-blue-600">
              <Clock className="h-3.5 w-3.5" />
              كرون كل دقيقة
            </span>
            <span className="flex items-center gap-1 text-[11px] font-black text-violet-600">
              <Cpu className="h-3.5 w-3.5" />
              {cron.jobsCompleted.toLocaleString("ar-SA")} مهمة منجزة
            </span>
          </div>
        </div>
      </div>

      {/* Gauge row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <CircleGauge pct={aiPct} label="الذكاء الاصطناعي" sublabel="توكن شهرياً" icon={Cpu} />
        <CircleGauge pct={dbPct} label="قاعدة البيانات" sublabel="مساحة التخزين" icon={Database} />
        <CircleGauge pct={hostingPct} label="الاستضافة" sublabel="ساعات تشغيل" icon={Server} />
        <CircleGauge pct={emailPct} label="البريد الآلي" sublabel="رسائل شهرياً" icon={Mail} />
      </div>

      {/* Detail bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricBar
          label="الذكاء الاصطناعي (AI Tokens)"
          used={ai.used}
          limit={ai.limit}
          unit="توكن"
          icon={Cpu}
        />
        <MetricBar
          label="قاعدة البيانات"
          used={Math.round(db.usedMB)}
          limit={db.limitMB}
          unit="MB"
          icon={Database}
        />
        <MetricBar
          label="ساعات الاستضافة"
          used={Math.round(hosting.uptimeHours)}
          limit={hosting.limitHours}
          unit="ساعة"
          icon={Server}
        />
        <MetricBar
          label="البريد الآلي"
          used={email.sent}
          limit={email.limit}
          unit="رسالة"
          icon={Mail}
        />
      </div>

      {/* Services status */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h3 className="font-black text-sm text-slate-700 uppercase tracking-widest mb-4">حالة الخدمات</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: "قاعدة البيانات", ok: mongo.connected, detail: mongo.connected ? "متصلة بنجاح" : "منقطعة" },
            { label: "الكرون (Cron)", ok: true, detail: `كل دقيقة — ${cron.jobsCompleted} مهمة` },
            { label: "الذكاء الاصطناعي", ok: aiPct < 95, detail: aiPct < 95 ? "يعمل بشكل طبيعي" : "اقترب من الحد" },
            { label: "البريد الإلكتروني", ok: emailPct < 90, detail: `${email.sent} من ${email.limit} مُرسَل` },
            { label: "الاستضافة", ok: hostingPct < 95, detail: `${Math.round(hosting.uptimeHours)} ساعة نشطة` },
            { label: "المعالجة الخلفية", ok: cron.jobsFailed === 0, detail: cron.jobsFailed === 0 ? "لا أخطاء" : `${cron.jobsFailed} خطأ` },
          ].map((svc) => (
            <div key={svc.label} className={`p-3 rounded-xl border flex items-start gap-3 ${
              svc.ok ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
            }`}>
              {svc.ok
                ? <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                : <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              }
              <div>
                <p className="font-black text-xs text-slate-800">{svc.label}</p>
                <p className={`text-[10px] font-bold mt-0.5 ${svc.ok ? "text-emerald-600" : "text-red-600"}`}>{svc.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-slate-300 font-bold text-center">يتحدث تلقائياً كل دقيقة · البيانات للاطلاع الداخلي فقط</p>
    </div>
  );
}
