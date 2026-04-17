import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, X, Send, Sparkles, MessageSquare, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface StyleAssistantProps {
  currentProduct?: string;
  cartItems?: string[];
}

const QUICK_PROMPTS = [
  "ما الذي يناسب هذا المنتج؟",
  "اقترحي لي إطلالة كاملة",
  "ما المناسبات المناسبة له؟",
  "نصيحة في التنسيق",
];

export function StyleAssistant({ currentProduct, cartItems }: StyleAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: `مرحباً! أنا نوف ✨ مستشارتك العطور في رفيف العود. ${
          currentProduct ? `أرى أنك تتصفحين "${currentProduct}" — ` : ""
        }كيف يمكنني مساعدتك في إطلالتك اليوم؟`,
      }]);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");

    const newMessages: Message[] = [...messages, { role: "user", content: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          context: { currentProduct, cartItems },
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply || "عذراً، حدث خطأ" }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "عذراً، حدث خطأ في الاتصال" }]);
    }
    setLoading(false);
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-24 left-4 z-50 h-14 w-14 rounded-full bg-primary text-white shadow-2xl flex items-center justify-center group"
            style={{ boxShadow: "0 8px 32px rgba(5, 148, 103, 0.4)" }}
          >
            <div className="relative">
              <Sparkles className="h-6 w-6" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-white rounded-full border-2 border-primary animate-pulse" />
            </div>
            <div className="absolute right-full ml-3 mr-3 bg-black text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              مستشارة الأزياء AI
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 left-4 z-50 w-80 max-w-[calc(100vw-2rem)] bg-white border border-black/10 shadow-2xl flex flex-col overflow-hidden"
            style={{ borderRadius: 0, maxHeight: minimized ? "auto" : "520px" }}
          >
            {/* Header */}
            <div className="bg-primary px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-black text-sm">نوف — مستشارة الأزياء</p>
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-300 animate-pulse" />
                    <p className="text-white/70 text-[9px] font-bold uppercase tracking-widest">AI • متاحة الآن</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setMinimized(m => !m)} className="h-7 w-7 flex items-center justify-center text-white/60 hover:text-white">
                  <ChevronDown className={`h-4 w-4 transition-transform ${minimized ? "rotate-180" : ""}`} />
                </button>
                <button onClick={() => setOpen(false)} className="h-7 w-7 flex items-center justify-center text-white/60 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar" style={{ minHeight: "280px", maxHeight: "320px" }} dir="rtl">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                      {msg.role === "assistant" && (
                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                          <Sparkles className="h-3 w-3 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] px-3 py-2 text-xs leading-relaxed font-medium ${
                          msg.role === "user"
                            ? "bg-black text-white"
                            : "bg-gray-50 border border-black/5 text-black/80"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-end">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center ml-2">
                        <Sparkles className="h-3 w-3 text-primary" />
                      </div>
                      <div className="bg-gray-50 border border-black/5 px-3 py-2">
                        <div className="flex gap-1">
                          {[0,1,2].map(i => (
                            <span key={i} className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts */}
                {messages.length <= 1 && (
                  <div className="px-3 pb-2 flex flex-wrap gap-1" dir="rtl">
                    {QUICK_PROMPTS.map(p => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        className="text-[9px] font-black uppercase tracking-widest border border-primary/30 text-primary px-2 py-1 hover:bg-primary hover:text-white transition-all"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="border-t border-black/5 p-3 flex gap-2" dir="rtl">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    placeholder="اسأليني عن الأزياء والتنسيق..."
                    className="flex-1 h-9 text-xs font-bold border-black/10"
                    disabled={loading}
                  />
                  <Button
                    size="sm"
                    onClick={() => sendMessage()}
                    disabled={!input.trim() || loading}
                    className="h-9 w-9 p-0 flex-shrink-0"
                  >
                    {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
