import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, Plus, ChevronDown } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export function IOSInstallGuide() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIOS = /iPhone|iPad|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    const dismissed = localStorage.getItem("ios_install_guide_seen");
    if (!isIOS || !isSafari || isStandalone || dismissed) return;
    const t = setTimeout(() => setOpen(true), 6000);
    return () => clearTimeout(t);
  }, []);

  const close = () => {
    setOpen(false);
    localStorage.setItem("ios_install_guide_seen", "1");
  };

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % 2);
    }, 3500);
    return () => clearInterval(interval);
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={close}
          dir={ar ? "rtl" : "ltr"}
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
            data-testid="dialog-ios-install"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-[#1a2744] via-[#243154] to-[#1a2744] px-6 pt-6 pb-8 text-white">
              <button
                onClick={close}
                className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                data-testid="button-close-ios-guide"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 mb-3">
                  <img src="/icons/icon-192x192.png" alt="" className="w-10 h-10 rounded-xl" />
                </div>
                <h2 className="text-xl font-black tracking-tight">
                  {ar ? "حمّل تطبيق عطور آر اف" : "Install RF Perfume App"}
                </h2>
                <p className="text-[12px] text-white/60 mt-1.5 font-medium">
                  {ar
                    ? "تجربة فاخرة على شاشتك الرئيسية بثلاث خطوات"
                    : "A luxury experience on your home screen in 3 steps"}
                </p>
              </div>
            </div>

            {/* iPhone Mockup */}
            <div className="px-6 pt-6 pb-2 bg-gradient-to-b from-stone-50 to-white">
              <div className="relative mx-auto w-[220px] h-[340px] rounded-[36px] bg-black p-2 shadow-2xl">
                {/* Notch */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-black rounded-b-2xl z-10" />
                {/* Screen */}
                <div className="relative w-full h-full rounded-[28px] bg-white overflow-hidden">
                  {/* Status bar */}
                  <div className="h-7 bg-stone-100 flex items-center justify-between px-4 text-[8px] font-bold text-stone-700">
                    <span>9:41</span>
                    <span>•••</span>
                  </div>
                  {/* URL bar */}
                  <div className="px-2 py-1.5 bg-stone-100 border-b border-stone-200">
                    <div className="bg-white rounded-md px-2 py-1 text-[8px] text-stone-500 text-center font-medium truncate">
                      🔒 rfperfume.sa
                    </div>
                  </div>
                  {/* Page preview */}
                  <div className="p-3 space-y-2 bg-gradient-to-b from-amber-50/50 to-white">
                    <div className="text-center">
                      <div className="text-[9px] font-black text-stone-900">عطور آر اف</div>
                      <div className="text-[6px] text-amber-600 tracking-widest mt-0.5">
                        LUXURY FRAGRANCES
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="aspect-square rounded bg-gradient-to-br from-amber-200 to-amber-400" />
                      <div className="aspect-square rounded bg-gradient-to-br from-stone-300 to-stone-500" />
                    </div>
                  </div>
                  {/* Bottom Safari toolbar */}
                  <div className="absolute bottom-0 left-0 right-0 h-9 bg-stone-100/95 backdrop-blur border-t border-stone-200 flex items-center justify-around px-2">
                    <div className="text-stone-400 text-[10px]">‹</div>
                    <div className="text-stone-400 text-[10px]">›</div>
                    {/* Share button — highlighted in step 0 */}
                    <motion.div
                      animate={
                        step === 0
                          ? { scale: [1, 1.25, 1], y: [0, -4, 0] }
                          : { scale: 1, y: 0 }
                      }
                      transition={{ repeat: step === 0 ? Infinity : 0, duration: 1.4 }}
                      className={`relative w-7 h-7 rounded-md flex items-center justify-center ${
                        step === 0 ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50" : "text-stone-500"
                      }`}
                    >
                      <Share className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {step === 0 && (
                        <motion.div
                          animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                          transition={{ repeat: Infinity, duration: 1.4 }}
                          className="absolute inset-0 rounded-md bg-blue-400"
                        />
                      )}
                    </motion.div>
                    <div className="text-stone-400 text-[10px]">📚</div>
                    <div className="text-stone-400 text-[10px]">⊞</div>
                  </div>

                  {/* Step 1 overlay: share sheet with "Add to Home Screen" */}
                  <AnimatePresence>
                    {step === 1 && (
                      <motion.div
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 20 }}
                        className="absolute bottom-0 left-0 right-0 bg-stone-50/98 backdrop-blur-xl rounded-t-2xl p-2 shadow-2xl border-t border-stone-200"
                      >
                        <div className="w-8 h-0.5 bg-stone-300 rounded-full mx-auto mb-2" />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 px-2 py-1 text-[8px] text-stone-400">
                            <span>نسخ</span>
                          </div>
                          <div className="flex items-center gap-2 px-2 py-1 text-[8px] text-stone-400">
                            <span>إضافة إلى المفضلة</span>
                          </div>
                          <motion.div
                            animate={{ scale: [1, 1.04, 1] }}
                            transition={{ repeat: Infinity, duration: 1.4 }}
                            className="flex items-center gap-2 px-2 py-1.5 bg-blue-500 rounded-md text-white shadow-lg shadow-blue-500/40"
                          >
                            <Plus className="w-3 h-3" strokeWidth={3} />
                            <span className="text-[8px] font-black">إضافة إلى الشاشة الرئيسية</span>
                          </motion.div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Steps */}
            <div className="px-6 py-5 space-y-3 bg-white">
              <Step
                num={1}
                active={step === 0}
                title={ar ? "اضغط على زر المشاركة" : "Tap the Share button"}
                desc={
                  ar
                    ? "في شريط Safari السفلي — أيقونة المربع مع السهم"
                    : "In Safari's bottom bar — the square with arrow"
                }
                icon={<Share className="w-4 h-4" />}
              />
              <Step
                num={2}
                active={step === 1}
                title={ar ? "اختر «إضافة إلى الشاشة الرئيسية»" : "Choose 'Add to Home Screen'"}
                desc={
                  ar
                    ? "مرّر للأسفل في القائمة المنبثقة"
                    : "Scroll down in the sheet that appears"
                }
                icon={<Plus className="w-4 h-4" />}
              />
              <Step
                num={3}
                active={false}
                title={ar ? "اضغط «إضافة»" : "Tap 'Add'"}
                desc={
                  ar
                    ? "ستجد التطبيق على شاشتك الرئيسية كأي تطبيق آخر ✨"
                    : "Find the app on your home screen like any other app ✨"
                }
                icon={<ChevronDown className="w-4 h-4" />}
              />
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-2 bg-white">
              <button
                onClick={close}
                className="w-full h-12 rounded-2xl bg-foreground text-background font-black text-[12px] tracking-widest uppercase hover:bg-foreground/90 active:scale-[0.98] transition-all"
                data-testid="button-ios-guide-got-it"
              >
                {ar ? "فهمت — جربها الآن" : "Got it — I'll try"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Step({
  num,
  active,
  title,
  desc,
  icon,
}: {
  num: number;
  active: boolean;
  title: string;
  desc: string;
  icon: React.ReactNode;
}) {
  return (
    <motion.div
      animate={{
        backgroundColor: active ? "rgba(26, 39, 68, 0.05)" : "rgba(0,0,0,0)",
        scale: active ? 1.02 : 1,
      }}
      className="flex items-start gap-3 p-2.5 rounded-xl transition-colors"
    >
      <div
        className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-black text-[11px] transition-all ${
          active
            ? "bg-[#1a2744] text-white shadow-lg"
            : "bg-stone-100 text-stone-400"
        }`}
      >
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[13px] font-black ${active ? "text-stone-900" : "text-stone-600"}`}>
            {title}
          </span>
          <span className={active ? "text-blue-500" : "text-stone-400"}>{icon}</span>
        </div>
        <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </motion.div>
  );
}
