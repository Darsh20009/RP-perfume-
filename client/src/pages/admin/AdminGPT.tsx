/**
 * Admin AI Assistant — يستخدم Puter.js (مجاني 100%، بدون API key)
 * GPT-4o مباشرة في المتصفح عبر puter.ai.chat()
 */
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send, Trash2, Bot, User, Loader2, AlertCircle,
  ExternalLink, MonitorPlay, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/* ── Puter.js global type ── */
declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (
          messages: { role: string; content: string }[] | string,
          options?: { model?: string; stream?: boolean }
        ) => Promise<{ message: { content: string } } | ReadableStream>;
      };
    };
  }
}

/* ── Markdown renderer (lightweight) ── */
function MdText({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.split("\n");
          const lang = lines[0].replace("```", "").trim();
          const code = lines.slice(1, -1).join("\n");
          return (
            <div key={i}>
              {lang && (
                <span className="text-[9px] font-mono text-black/40 uppercase tracking-widest px-2">
                  {lang}
                </span>
              )}
              <pre className="bg-black/10 rounded-none p-3 overflow-x-auto text-[11px] font-mono whitespace-pre leading-relaxed">
                {code}
              </pre>
            </div>
          );
        }
        const html = part
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/`([^`]+)`/g, '<code class="bg-black/10 px-1 rounded text-[11px] font-mono">$1</code>')
          .replace(/^### (.+)$/gm, '<p class="font-black text-[#2B2B60] text-sm mt-2">$1</p>')
          .replace(/^## (.+)$/gm, '<p class="font-black text-[#2B2B60] mt-3">$1</p>')
          .replace(/^# (.+)$/gm, '<p class="font-black text-[#2B2B60] text-base mt-3">$1</p>')
          .replace(/^- (.+)$/gm, '<li class="mr-4 list-disc">$1</li>')
          .replace(/\n/g, "<br />");
        return (
          <p
            key={i}
            className="leading-relaxed text-[13px]"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}

/* ── Types ── */
interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: number;
}

const STORAGE_KEY = "rf_admin_ai_history_v2";

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch { return []; }
}

function saveHistory(msgs: Message[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-60))); } catch {}
}

/* ── System prompt (client-side, enriched with live stats) ── */
function buildSystemPrompt(stats?: any): string {
  const today = new Date().toLocaleDateString("ar-SA", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const statsText = stats
    ? `\n## إحصائيات حية (${today})\n- منتجات نشطة: ${stats.products ?? "؟"}\n- إجمالي الطلبات: ${stats.orders ?? "؟"} (معلق: ${stats.pending ?? "؟"})\n- عملاء: ${stats.customers ?? "؟"}\n- إيرادات مكتملة: ${stats.revenue ?? "؟"} ريال\n`
    : "";

  return `أنت مساعد تطوير متخصص في نظام **رفيف العود | RF Perfume** — منصة تجارة إلكترونية فاخرة للعطور العربية.

## Stack التقني
- **Frontend:** React 18 + Vite + Tailwind CSS + Radix UI + TanStack Query + Wouter
- **Backend:** Express.js + TypeScript
- **Database:** MongoDB Atlas + Mongoose
- **Auth:** Passport.js (local + Google OAuth + Apple Sign-In) + express-session
- **المدفوعات:** Paymob, Tabby, Tamara, STC Pay, Apple Pay
- **الشحن:** Shipox/3rd Mile + Storage Station (3PL)
- **الذكاء الاصطناعي:** Kimi Moonshot (moonshot-v1-8k/32k)
- **البريد:** SMTP2Go
- **أدوار RBAC:** admin, assistant_manager, tech_support, accountant, employee, cashier, support

## هيكل الملفات
\`\`\`
client/src/pages/Admin.tsx          — لوحة أدمن رئيسية (6700+ سطر)
client/src/pages/admin/             — صفحات فرعية (Email, Inbox, Stats...)
client/src/components/admin/        — مكونات أدمن (EmployeeAssistant...)
server/routes.ts                    — كل API routes
server/employee-assistant.ts        — المساعد الداخلي Lamsa + 16 أداة tool-calling
server/models.ts                    — Mongoose schemas (Product, Order, User...)
server/auth.ts                      — المصادقة
server/email.ts                     — البريد الإلكتروني
server/kimi.ts                      — Moonshot AI provider
server/groq.ts                      — AI dispatcher (يوجّه إلى Kimi)
server/shipox.ts                    — تكامل الشحن Shipox
server/notifications.ts             — WebSocket + Push notifications
server/uploads.ts                   — رفع الملفات (local + Replit Object Storage)
server/static.ts                    — تقديم الملفات الثابتة (production)
shared/schema.ts                    — Zod schemas مشتركة
shared/routes.ts                    — API endpoint constants
\`\`\`

## قواعد تطوير مهمة
1. **RTL:** كل مكونات عربية تحتاج \`dir="rtl"\`
2. **Mongoose:** استخدم \`.lean()\` للقراءة فقط
3. **Atomic ops:** مخزون وطلبات → \`$inc\`, \`findOneAndUpdate\`
4. **Auth middleware:** كل admin API يحتاج \`requireAuth\` + \`requireAdmin\`
5. **Sessions:** \`SameSite=None; Secure\` للـ Replit preview
6. **AI pipeline:** \`groq.ts\` → \`kimi.ts\` → \`moonshot-v1-8k\`
7. **Uploads:** \`/uploads/:key\` يخدم من disk أو Replit Object Storage تلقائياً
${statsText}
## تعليمات الإجابة
- أجب بالعربية أو الإنجليزية حسب لغة السؤال
- اكتب كوداً نظيفاً مكتملاً مع شرح موجز
- استشهد بأسماء الملفات والدوال الفعلية
- ساعد في: ميزات جديدة، تصحيح أخطاء، فهم الكود، تحسين الأداء، إضافة APIs
- اليوم: ${today}`;
}

/* ═══════════════════════════════════════════════════════ */
export default function AdminGPT() {
  const [messages, setMessages] = useState<Message[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [puterReady, setPuterReady] = useState(false);
  const [showSite, setShowSite] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Fetch live stats ── */
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats-summary"],
    queryFn: async () => {
      try {
        const r = await apiRequest("GET", "/api/admin/stats?period=all");
        if (!r.ok) return null;
        const d = await r.json();
        return d;
      } catch { return null; }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  /* ── Load Puter.js from CDN ── */
  useEffect(() => {
    if (window.puter) { setPuterReady(true); return; }
    const script = document.createElement("script");
    script.src = "https://js.puter.com/v2/";
    script.async = true;
    script.onload = () => {
      setTimeout(() => {
        if (window.puter) setPuterReady(true);
      }, 800);
    };
    script.onerror = () => setError("تعذّر تحميل Puter.js — تحقق من الاتصال بالإنترنت");
    document.head.appendChild(script);
    return () => { try { document.head.removeChild(script); } catch {} };
  }, []);

  /* ── Auto scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => { saveHistory(messages); }, [messages]);

  /* ── Send message ── */
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || !puterReady) return;

    const userMsg: Message = { role: "user", content: text, ts: Date.now() };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const systemPrompt = buildSystemPrompt(stats);
      const conversation = [
        { role: "system", content: systemPrompt },
        ...nextMsgs.slice(-16).map(({ role, content }) => ({ role, content })),
      ];

      const result = await window.puter!.ai.chat(conversation, { model: "gpt-4o-mini" }) as any;

      // Puter returns {message:{content}} or the content directly
      const reply: string =
        typeof result === "string"
          ? result
          : result?.message?.content ?? result?.content ?? JSON.stringify(result);

      setMessages((prev) => [...prev, { role: "assistant", content: reply, ts: Date.now() }]);
    } catch (err: any) {
      console.error("[AdminGPT]", err);
      setError(err?.message || "خطأ في الاتصال بـ Puter AI");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, puterReady, stats]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  /* ═══════════════════════════════ UI ═══════════════════════════════ */
  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden border border-black/10">

      {/* ── Site iframe ── */}
      {showSite && (
        <div className="relative flex-1 border-l border-black/10 bg-white min-w-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-black/10 bg-[#2B2B60]/5">
            <div className="flex items-center gap-2">
              <MonitorPlay className="w-3.5 h-3.5 text-[#2B2B60]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#2B2B60]">
                معاينة المتجر
              </span>
            </div>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-black/40 hover:text-[#2B2B60] transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              فتح
            </a>
          </div>
          <iframe
            src="/"
            title="معاينة المتجر"
            className="w-full h-[calc(100%-40px)] border-0"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      )}

      {/* ── Chat panel ── */}
      <div className="flex flex-col w-full max-w-xl min-w-[340px] bg-white">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 bg-[#2B2B60]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-white tracking-tight">مساعد RF الذكي</p>
              <p className="text-[9px] font-medium tracking-widest uppercase flex items-center gap-1.5">
                {puterReady ? (
                  <span className="text-emerald-300">● GPT-4o · مجاني</span>
                ) : (
                  <span className="text-white/40 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" /> يتحمل...
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSite((s) => !s)}
              className="text-[9px] font-black text-white/60 hover:text-white uppercase tracking-widest transition-colors"
            >
              {showSite ? "إخفاء المتجر" : "إظهار المتجر"}
            </button>
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-white/40 hover:text-red-300 transition-colors"
                title="مسح المحادثة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Loading banner */}
        {!puterReady && (
          <div className="mx-4 mt-3 flex items-center gap-2 border border-blue-200 bg-blue-50 px-3 py-2">
            <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin shrink-0" />
            <p className="text-[11px] text-blue-700">يتم تحميل محرك الذكاء الاصطناعي (Puter)...</p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-3 flex items-start gap-2 border border-red-200 bg-red-50 px-3 py-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-700">{error}</p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4" dir="auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-[#2B2B60]/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-[#2B2B60]" />
              </div>
              <div>
                <p className="font-black text-[#2B2B60] text-sm">مساعد تطوير RF</p>
                <p className="text-[11px] text-black/40 mt-1 max-w-[220px] leading-relaxed">
                  اسألني عن الكود، الميزات، الأخطاء، أو أي شيء في النظام
                </p>
              </div>
              <div className="grid gap-2 w-full max-w-[260px] mt-2">
                {[
                  "كيف أضيف API جديد في routes.ts؟",
                  "وضّح لي كيف تعمل المدفوعات",
                  "كيف أضيف حقل جديد في MongoDB؟",
                  "اشرح لي هيكل المصادقة في النظام",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-right text-[11px] text-[#2B2B60] border border-[#2B2B60]/20 hover:border-[#2B2B60]/60 hover:bg-[#2B2B60]/5 px-3 py-2 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                  msg.role === "user" ? "bg-[#DFB369]" : "bg-[#2B2B60]"
                }`}
              >
                {msg.role === "user"
                  ? <User className="w-3.5 h-3.5 text-white" />
                  : <Bot className="w-3.5 h-3.5 text-white" />}
              </div>
              <div
                className={`max-w-[85%] px-3 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#2B2B60] text-white rounded-tl-2xl rounded-bl-2xl rounded-tr-sm"
                    : "bg-black/5 text-black rounded-tr-2xl rounded-br-2xl rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant"
                  ? <MdText text={msg.content} />
                  : <p className="whitespace-pre-wrap">{msg.content}</p>}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5">
              <div className="w-6 h-6 rounded-full bg-[#2B2B60] flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-black/5 px-4 py-3 rounded-tr-2xl rounded-br-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2B2B60]" />
                <span className="text-[12px] text-black/40">يفكّر...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-black/10 p-3 bg-white">
          <div className="flex gap-2 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={
                puterReady
                  ? "اكتب سؤالك... (Enter للإرسال، Shift+Enter سطر جديد)"
                  : "يتم تحميل الذكاء الاصطناعي..."
              }
              className="flex-1 resize-none rounded-none border-black/20 text-sm min-h-[44px] max-h-[160px] text-right"
              rows={1}
              disabled={!puterReady || loading}
              dir="auto"
            />
            <Button
              onClick={send}
              disabled={!input.trim() || loading || !puterReady}
              className="rounded-none h-11 w-11 p-0 bg-[#2B2B60] hover:bg-[#2B2B60]/80 shrink-0"
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-[9px] text-black/30 mt-1.5 text-center tracking-wide">
            مجاني بالكامل · Puter AI · المحادثة محفوظة محلياً
          </p>
        </div>
      </div>
    </div>
  );
}
