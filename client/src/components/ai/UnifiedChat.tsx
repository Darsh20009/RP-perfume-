import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Send, X, Loader2, Sparkles, Headphones } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";

const LOGO_LIGHT = "/images/logos/logo-light-nobg.png";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type TabType = "advisor" | "support";
type ViewMode = "closed" | "menu" | "chat";

const WHATSAPP_URL = "https://api.whatsapp.com/send?phone=966551329821";

export const UnifiedChat = memo(function UnifiedChat() {
  const { user } = useAuth();
  const [view, setView] = useState<ViewMode>("closed");
  const [activeTab, setActiveTab] = useState<TabType>("advisor");
  const [advisorMessages, setAdvisorMessages] = useState<Message[]>([]);
  const [supportMessages, setSupportMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const messages = activeTab === "advisor" ? advisorMessages : supportMessages;
  const setMessages = activeTab === "advisor" ? setAdvisorMessages : setSupportMessages;

  useEffect(() => {
    if (view === "chat") messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [advisorMessages, supportMessages, view]);

  useEffect(() => {
    if (view === "chat" && inputRef.current) inputRef.current.focus();
  }, [view, activeTab]);

  const openChat = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setView("chat");
    if (tab === "advisor" && advisorMessages.length === 0) {
      setAdvisorMessages([{
        role: "assistant",
        content: "أهلاً بك في رفيف العود. أنا رفيف، مستشارك الشخصي للعطور — أخبرني عن ذوقك أو المناسبة وسأقترح لك العطر المثالي."
      }]);
    }
    if (tab === "support" && supportMessages.length === 0) {
      setSupportMessages([{
        role: "assistant",
        content: "مرحباً بك في الدعم الفني لرفيف العود. كيف يمكنني خدمتك؟\n\n• تتبع طلبك\n• معلومات المنتجات\n• سياسة الاسترجاع\n• استفسارات أخرى"
      }]);
    }
  }, [advisorMessages.length, supportMessages.length]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    const endpoint = activeTab === "advisor" ? "/api/ai/perfume-advisor" : "/api/ai/support";
    const body: any = {
      message: userMsg,
      history: messages.map(m => ({ role: m.role, content: m.content })),
    };
    if (activeTab === "support" && user) {
      body.customerInfo = { name: (user as any).firstName || (user as any).phone };
    }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.response || "عذراً، لم أستلم رداً." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "عذراً، حدث خطأ في الاتصال. حاول مرة أخرى." }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeTab, messages, user, setMessages]);

  const isAdvisor = activeTab === "advisor";
  const accentColor = isAdvisor ? "#c9a96e" : "#1a2744";

  return (
    <div className="fixed bottom-6 left-0 z-50" dir="rtl">
      {/* ── Closed Side-Tab (square, logo, protrudes from edge) ───── */}
      <AnimatePresence>
        {view === "closed" && (
          <motion.button
            key="fab"
            initial={{ opacity: 0, x: -80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -80 }}
            transition={{ type: "spring", stiffness: 220, damping: 24 }}
            onClick={() => setView("menu")}
            aria-label="افتح قائمة التواصل"
            className="group relative flex items-center justify-center w-16 h-20 shadow-[8px_8px_40px_rgba(26,39,68,0.4)] hover:w-20 transition-all duration-300 active:scale-95 overflow-hidden"
            style={{
              borderTopRightRadius: 22,
              borderBottomRightRadius: 22,
              background: "linear-gradient(135deg, #1a2744 0%, #243154 50%, #1a2744 100%)",
            }}
          >
            {/* Gold border on the right edge */}
            <span
              className="absolute right-0 top-0 bottom-0 w-1"
              style={{ background: "linear-gradient(to bottom, #d4b87a, #c9a96e, #b8944f)" }}
            />
            {/* Inner gold ring */}
            <span
              className="absolute inset-0 pointer-events-none"
              style={{
                borderTop: "1px solid rgba(201,169,110,0.4)",
                borderBottom: "1px solid rgba(201,169,110,0.4)",
                borderTopRightRadius: 22,
                borderBottomRightRadius: 22,
              }}
            />
            {/* Live dot */}
            <span className="absolute top-2 right-2.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-md ring-1 ring-white/50" />
            {/* Logo */}
            <img
              src={LOGO_LIGHT}
              alt="رفيف العود"
              className="relative h-12 w-auto object-contain transition-transform group-hover:scale-110 drop-shadow-lg"
              draggable={false}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Menu (3 channels) ───────────────────────────────── */}
      <AnimatePresence>
        {view === "menu" && (
          <motion.div
            key="menu"
            initial={{ opacity: 0, x: -30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="ml-3 w-[320px] bg-white rounded-3xl shadow-[0_20px_60px_rgba(26,39,68,0.18)] border border-[#c9a96e]/15 overflow-hidden"
          >
            {/* Header */}
            <div className="relative px-5 py-5" style={{ background: "linear-gradient(135deg, #1a2744 0%, #243154 100%)" }}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-white font-black text-base tracking-tight">كيف يمكننا خدمتك؟</h4>
                  <p className="text-white/60 text-[11px] font-semibold mt-0.5">اختر طريقة التواصل المفضلة</p>
                </div>
                <button
                  onClick={() => setView("closed")}
                  aria-label="إغلاق"
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#c9a96e] to-transparent" />
            </div>

            {/* Options */}
            <div className="p-3 space-y-2 bg-white">
              {/* AI Advisor */}
              <button
                onClick={() => openChat("advisor")}
                className="group w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#c9a96e]/5 transition-all active:scale-[0.98] border border-transparent hover:border-[#c9a96e]/20"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md" style={{ background: "linear-gradient(135deg, #d4b87a, #b8944f)" }}>
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 text-right min-w-0">
                  <p className="font-black text-sm text-[#1a2744]">مستشار العطور</p>
                  <p className="text-[11px] text-gray-400 font-medium truncate">اعثر على عطرك المثالي بالذكاء</p>
                </div>
                <span className="text-[9px] font-black text-[#c9a96e] bg-[#c9a96e]/10 px-2 py-1 rounded-full">AI</span>
              </button>

              {/* Support */}
              <button
                onClick={() => openChat("support")}
                className="group w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#1a2744]/5 transition-all active:scale-[0.98] border border-transparent hover:border-[#1a2744]/20"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md" style={{ background: "linear-gradient(135deg, #243154, #0f1a2e)" }}>
                  <Headphones className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 text-right min-w-0">
                  <p className="font-black text-sm text-[#1a2744]">الدعم الفني</p>
                  <p className="text-[11px] text-gray-400 font-medium truncate">طلباتك واستفساراتك على مدار الساعة</p>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </button>

              {/* WhatsApp */}
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="group w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-[#25D366]/5 transition-all active:scale-[0.98] border border-transparent hover:border-[#25D366]/20"
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md" style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}>
                  <SiWhatsapp className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 text-right min-w-0">
                  <p className="font-black text-sm text-[#1a2744]">واتساب</p>
                  <p className="text-[11px] text-gray-400 font-medium truncate">حوار مباشر مع فريق المبيعات</p>
                </div>
                <span className="text-[9px] font-black text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">سريع</span>
              </a>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-gradient-to-l from-[#faf8f5] to-white border-t border-[#c9a96e]/10 text-center">
              <p className="text-[10px] text-gray-400 font-bold tracking-wide">
                رفيف العود <span className="text-[#c9a96e]">·</span> RF Perfume
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Chat panel ──────────────────────────────────────── */}
      <AnimatePresence>
        {view === "chat" && (
          <motion.div
            key="chat"
            initial={{ opacity: 0, x: -30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -30, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="ml-3 w-[400px] max-w-[calc(100vw-1.5rem)] bg-white rounded-3xl shadow-[0_20px_60px_rgba(26,39,68,0.18)] border border-[#c9a96e]/15 overflow-hidden flex flex-col"
            style={{ height: "min(560px, calc(100vh - 8rem))" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100" style={{ background: `linear-gradient(135deg, ${accentColor}12, transparent)` }}>
              <button
                onClick={() => setView("menu")}
                aria-label="رجوع"
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 12L10 8L6 4" stroke="#1a2744" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="flex items-center gap-2.5">
                <div>
                  <h4 className="font-black text-sm text-[#1a2744] text-center">
                    {isAdvisor ? "رفيف — مستشار العطور" : "الدعم الفني"}
                  </h4>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-gray-400 font-bold">متصل الآن</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-md" style={{ background: `linear-gradient(135deg, ${accentColor}, ${isAdvisor ? "#b8944f" : "#0f1a2e"})` }}>
                  {isAdvisor ? <Sparkles className="h-4 w-4 text-white" /> : <Headphones className="h-4 w-4 text-white" />}
                </div>
              </div>
              <button
                onClick={() => setView("closed")}
                aria-label="إغلاق"
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-[#faf8f5]/40">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line shadow-sm ${
                      msg.role === "user"
                        ? `text-white rounded-tr-none`
                        : "bg-white text-[#1a2744] rounded-tl-none border border-gray-100"
                    }`}
                    style={msg.role === "user" ? { background: `linear-gradient(135deg, ${accentColor}, ${isAdvisor ? "#b8944f" : "#0f1a2e"})` } : undefined}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-end">
                  <div className="bg-white rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 border border-gray-100 shadow-sm">
                    <Loader2 className="h-4 w-4 animate-spin" style={{ color: accentColor }} />
                    <span className="text-xs text-gray-400 font-bold">رفيف يفكر...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={isAdvisor ? "اسأل رفيف عن العطور..." : "اكتب رسالتك..."}
                  className="flex-1 h-11 px-4 rounded-full bg-[#faf8f5] border border-gray-200 text-sm font-medium focus:outline-none focus:border-[#c9a96e] transition-all"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  aria-label="إرسال"
                  className="w-11 h-11 rounded-full text-white flex items-center justify-center transition-all disabled:opacity-40 active:scale-95 shrink-0 shadow-md"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, ${isAdvisor ? "#b8944f" : "#0f1a2e"})` }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="text-[9px] text-gray-400 text-center mt-2 font-bold tracking-wide">
                مدعوم بالذكاء الاصطناعي · رفيف العود
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
