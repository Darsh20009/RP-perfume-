import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Trash2, Bot, User, Loader2, AlertCircle, ExternalLink, MonitorPlay } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

/** Lightweight markdown renderer — handles code blocks, bold, inline code */
function MdText({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (part.startsWith("```")) {
          const lines = part.split("\n");
          const code = lines.slice(1, -1).join("\n");
          return (
            <pre key={i} className="bg-black/10 rounded-none p-2 overflow-x-auto text-[11px] font-mono whitespace-pre">
              {code}
            </pre>
          );
        }
        // Inline: bold, inline code, line breaks
        const html = part
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/`([^`]+)`/g, '<code class="bg-black/10 px-1 rounded text-[11px] font-mono">$1</code>')
          .replace(/\n/g, "<br />");
        return <p key={i} className="leading-relaxed text-[13px]" dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </div>
  );
}

interface Message {
  role: "user" | "assistant";
  content: string;
  ts?: number;
}

const STORAGE_KEY = "rf_admin_gpt_history";

function loadHistory(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch {
    return [];
  }
}

function saveHistory(msgs: Message[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-60)));
  } catch {}
}

export default function AdminGPT() {
  const [messages, setMessages] = useState<Message[]>(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSite, setShowSite] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: status } = useQuery({
    queryKey: ["/api/admin/chatgpt-status"],
    queryFn: () => apiRequest("GET", "/api/admin/chatgpt-status").then((r) => r.json()),
    retry: false,
  });

  const configured: boolean = status?.configured ?? false;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text, ts: Date.now() };
    const nextMsgs = [...messages, userMsg];
    setMessages(nextMsgs);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const payload = nextMsgs.map(({ role, content }) => ({ role, content }));
      const res = await apiRequest("POST", "/api/admin/chatgpt-chat", { messages: payload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "خطأ غير معروف");
      const assistantMsg: Message = { role: "assistant", content: data.reply, ts: Date.now() };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err?.message || "تعذّر الاتصال بـ ChatGPT");
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="flex h-[calc(100vh-120px)] gap-0 overflow-hidden rounded-none border border-black/10">
      {/* ── Site Preview (iframe) ─────────────────────────── */}
      {showSite && (
        <div className="relative flex-1 border-l border-black/10 bg-white min-w-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-black/10 bg-[#2B2B60]/5">
            <div className="flex items-center gap-2">
              <MonitorPlay className="w-3.5 h-3.5 text-[#2B2B60]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#2B2B60]">معاينة المتجر</span>
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

      {/* ── Chat Panel ───────────────────────────────────── */}
      <div className="flex flex-col w-full max-w-xl min-w-[340px] bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-black/10 bg-[#2B2B60]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-black text-white tracking-tight">ChatGPT — مساعد RF</p>
              <p className="text-[9px] text-white/50 font-medium tracking-widest uppercase">
                {configured ? `gpt-4o · ${messages.length} رسالة` : "غير مضبوط"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* Not configured banner */}
        {!configured && status !== undefined && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-none border border-amber-200 bg-amber-50 p-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              <strong>OPENAI_API_KEY</strong> غير مضبوط. أضفه في إعدادات Replit Secrets لتفعيل المساعد.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm" dir="auto">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-[#2B2B60]/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-[#2B2B60]" />
              </div>
              <div>
                <p className="font-black text-[#2B2B60] text-sm">مساعد RF الذكي</p>
                <p className="text-[11px] text-black/40 mt-1 max-w-[220px] leading-relaxed">
                  اسألني عن أي شيء في النظام — تطوير، كود، بيانات، أخطاء...
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 w-full max-w-[260px] mt-2">
                {[
                  "كيف أضيف ميزة جديدة للكارت؟",
                  "وضح لي هيكل قاعدة البيانات",
                  "كيف تعمل المدفوعات في النظام؟",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-right text-[11px] text-[#2B2B60] border border-[#2B2B60]/20 hover:border-[#2B2B60]/60 hover:bg-[#2B2B60]/5 px-3 py-2 transition-colors rounded-none"
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
                {msg.role === "user" ? (
                  <User className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-white" />
                )}
              </div>
              <div
                className={`max-w-[85%] px-3 py-2.5 text-[13px] leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#2B2B60] text-white rounded-tl-2xl rounded-bl-2xl rounded-tr-sm"
                    : "bg-black/5 text-black rounded-tr-2xl rounded-br-2xl rounded-tl-sm"
                }`}
              >
                {msg.role === "assistant" ? (
                  <MdText text={msg.content} />
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-2.5 flex-row">
              <div className="w-6 h-6 rounded-full bg-[#2B2B60] flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-black/5 px-4 py-3 rounded-tr-2xl rounded-br-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2B2B60]" />
                <span className="text-[12px] text-black/40">يفكّر...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 px-3 py-2 rounded-none">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-black/10 p-3 bg-white">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="اكتب سؤالك... (Enter للإرسال، Shift+Enter لسطر جديد)"
              className="flex-1 resize-none rounded-none border-black/20 text-sm min-h-[44px] max-h-[160px] text-right"
              rows={1}
              disabled={!configured || loading}
              dir="auto"
            />
            <Button
              onClick={send}
              disabled={!input.trim() || loading || !configured}
              className="rounded-none h-11 w-11 p-0 bg-[#2B2B60] hover:bg-[#2B2B60]/80 shrink-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[9px] text-black/30 mt-1.5 text-center tracking-wide">
            المحادثة محفوظة محلياً · GPT-4o
          </p>
        </div>
      </div>
    </div>
  );
}
