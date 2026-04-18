import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Send, X, Wand2, Loader2, CheckCircle2, AlertCircle, Bot, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Action = { tool: string; args: any; result: any };
type Message = {
  role: "user" | "assistant";
  content: string;
  actions?: Action[];
};

const TOOL_LABELS: Record<string, { ar: string; icon: string }> = {
  search_products: { ar: "البحث في المنتجات", icon: "🔍" },
  create_product: { ar: "إنشاء منتج", icon: "✨" },
  update_product_stock: { ar: "تحديث المخزون", icon: "📦" },
  search_orders: { ar: "البحث في الطلبات", icon: "🔎" },
  update_order_status: { ar: "تغيير حالة طلب", icon: "🚚" },
  search_customers: { ar: "البحث عن عميل", icon: "👤" },
  send_email_to_customer: { ar: "إرسال بريد للعميل", icon: "📧" },
  send_push_notification: { ar: "إرسال إشعار", icon: "🔔" },
};

const SUGGESTIONS = [
  "ابحث عن منتجات تحتوي كلمة عود",
  "أرني آخر 5 طلبات قيد التجهيز",
  "أنشئ منتج جديد اسمه عطر فجر العود بسعر 280 ريال",
  "ابحث عن العميل برقم 0501234567",
];

export function EmployeeAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!text.trim() || busy) return;
    const userMsg: Message = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setBusy(true);

    try {
      const res = await apiRequest("POST", "/api/admin/assistant", {
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      const data = await res.json();
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: data.reply || "تم.",
          actions: data.actions || [],
        },
      ]);

      // Refresh data caches if any mutating action was performed
      const mutated = (data.actions || []).some((a: Action) =>
        ["create_product", "update_product_stock", "update_order_status"].includes(a.tool)
      );
      if (mutated) {
        queryClient.invalidateQueries({ queryKey: ["/api/products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      }
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err.message || "تعذّر التواصل مع المساعد",
        variant: "destructive",
      });
      setMessages([
        ...newMessages,
        { role: "assistant", content: "عذراً، حدث خطأ. حاول مرة أخرى." },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating trigger */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.5, type: "spring" }}
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[60] group"
        data-testid="button-open-assistant"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-700 rounded-full blur-xl opacity-60 group-hover:opacity-90 transition-opacity animate-pulse" />
        <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-[#1a2744] via-[#243154] to-[#1a2744] border-2 border-amber-400/50 shadow-2xl flex items-center justify-center group-hover:scale-110 active:scale-95 transition-transform">
          <Sparkles className="w-7 h-7 text-amber-300" />
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 border-2 border-[#1a2744] flex items-center justify-center">
            <Wand2 className="w-2.5 h-2.5 text-[#1a2744]" />
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6"
            onClick={() => setOpen(false)}
            dir="rtl"
          >
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-2xl h-[92vh] sm:h-[80vh] bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              data-testid="dialog-assistant"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-br from-[#1a2744] via-[#243154] to-[#1a2744] px-5 py-4 text-white border-b-2 border-amber-400/30">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-5 h-5 text-[#1a2744]" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-black text-base tracking-tight">لمسة 🌸</h3>
                    <p className="text-[11px] text-amber-200/80 font-medium">
                      مساعدة الموظفين الذكية — تقدر تنفّذ الأوامر مباشرة
                    </p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                    data-testid="button-close-assistant"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-gradient-to-b from-stone-50 via-white to-stone-50"
              >
                {messages.length === 0 && (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 mb-4">
                      <Bot className="w-7 h-7 text-amber-700" />
                    </div>
                    <h4 className="font-black text-lg text-stone-900 mb-1">
                      مرحباً 👋
                    </h4>
                    <p className="text-[13px] text-stone-500 mb-5 max-w-sm mx-auto leading-relaxed">
                      أنا لمسة، مساعدتك. اطلب مني إنشاء منتج، البحث في الطلبات، إرسال إيميل لعميل، تحديث مخزون، وأكثر.
                    </p>
                    <div className="grid gap-2 max-w-md mx-auto text-right">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => send(s)}
                          className="px-4 py-2.5 rounded-xl bg-white border border-stone-200 hover:border-amber-300 hover:bg-amber-50/50 text-[12px] text-stone-700 font-medium text-right transition-all active:scale-[0.98]"
                          data-testid={`button-suggestion-${i}`}
                        >
                          ✨ {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <MessageBubble key={i} msg={msg} />
                ))}

                {busy && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-stone-100 max-w-[80%]">
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ y: [0, -6, 0] }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.15,
                          }}
                          className="w-2 h-2 rounded-full bg-amber-500"
                        />
                      ))}
                    </div>
                    <span className="text-[12px] text-stone-500 font-medium">
                      لمسة تفكر...
                    </span>
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="p-3 border-t border-stone-200 bg-white"
              >
                <div className="flex gap-2 items-center">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="اطلب شيئاً... مثلاً: أنشئ منتج عود ملكي بسعر 350"
                    disabled={busy}
                    className="flex-1 rounded-2xl border-stone-200 focus-visible:ring-amber-400 h-11 text-[13px]"
                    data-testid="input-assistant-message"
                  />
                  <Button
                    type="submit"
                    disabled={busy || !input.trim()}
                    className="rounded-2xl h-11 w-11 p-0 bg-gradient-to-br from-[#1a2744] to-[#243154] hover:opacity-90"
                    data-testid="button-send-assistant"
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-stone-200 text-stone-700"
            : "bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-md"
        }`}
      >
        {isUser ? <UserIcon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>
      <div className={`flex-1 max-w-[85%] ${isUser ? "text-right" : "text-right"}`}>
        <div
          className={`inline-block px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
            isUser
              ? "bg-[#1a2744] text-white rounded-tr-sm"
              : "bg-white border border-stone-200 text-stone-800 rounded-tl-sm shadow-sm"
          }`}
        >
          {msg.content}
        </div>
        {msg.actions && msg.actions.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {msg.actions.map((a, i) => (
              <ActionCard key={i} action={a} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ActionCard({ action }: { action: Action }) {
  const tool = TOOL_LABELS[action.tool] || { ar: action.tool, icon: "⚙️" };
  const ok = action.result?.ok !== false;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`px-3 py-2 rounded-xl border text-[11px] flex items-start gap-2 ${
        ok
          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
          : "bg-rose-50 border-rose-200 text-rose-900"
      }`}
    >
      <span className="shrink-0 text-base leading-none">{tool.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 font-bold">
          {ok ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <AlertCircle className="w-3 h-3" />
          )}
          <span>{tool.ar}</span>
        </div>
        {action.result?.message && (
          <p className="mt-0.5 text-[10.5px] opacity-80 leading-relaxed">
            {action.result.message}
          </p>
        )}
        {action.result?.error && (
          <p className="mt-0.5 text-[10.5px] opacity-80 leading-relaxed">
            {action.result.error}
          </p>
        )}
        {action.result?.count !== undefined && (
          <p className="mt-0.5 text-[10.5px] opacity-70">
            {action.result.count} نتيجة
          </p>
        )}
      </div>
    </motion.div>
  );
}
