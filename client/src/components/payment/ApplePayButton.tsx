import { useState } from "react";
import { Fingerprint, CheckCircle2 } from "lucide-react";
import { ApplePayLogo } from "@/components/payment/PaymentBrands";

interface ApplePayButtonProps {
  orderId: string;
  amount: number;
  onSuccess: (transactionId: string, receipt: any) => void;
  onError: (msg: string) => void;
}

type Step = "idle" | "sheet" | "biometric" | "processing" | "done";

export function ApplePayButton({ orderId, amount, onSuccess, onError }: ApplePayButtonProps) {
  const [step, setStep] = useState<Step>("idle");

  const handleClick = async () => {
    setStep("sheet");
    await new Promise(r => setTimeout(r, 600));
    setStep("biometric");
    await new Promise(r => setTimeout(r, 1800));
    setStep("processing");

    try {
      const res = await fetch("/api/pay/apple-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amount }),
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) { onError(data.error || "فشل Apple Pay"); setStep("idle"); return; }
      setStep("done");
      setTimeout(() => onSuccess(data.transactionId, data.receipt), 800);
    } catch { onError("خطأ في الاتصال"); setStep("idle"); }
  };

  if (step === "sheet" || step === "biometric") {
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" dir="ltr">
        <div className="w-full max-w-sm bg-white rounded-t-3xl p-6 space-y-6 animate-in slide-in-from-bottom">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto" />
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <ApplePayLogo className="h-10 object-contain" />
            </div>
            <p className="text-sm text-gray-800">عطور آر اف</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center">
            <span className="text-gray-800 text-sm">المبلغ</span>
            <span className="font-black text-lg">SAR {amount.toLocaleString()}</span>
          </div>
          <div className="bg-gray-50 rounded-2xl p-4 flex justify-between items-center text-sm text-gray-800">
            <span>Visa ••••0010</span>
            <div className="flex gap-1">
              <div className="w-4 h-4 rounded-full bg-[#EB001B]" />
              <div className="w-4 h-4 rounded-full bg-[#F79E1B] -ml-1.5" />
            </div>
          </div>
          {step === "biometric" ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="relative">
                <Fingerprint className="h-14 w-14 text-blue-500 animate-pulse" />
                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
              </div>
              <p className="text-sm font-bold text-gray-600">انظر إلى Face ID</p>
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="w-full h-14 bg-black flex items-center justify-center gap-2 rounded-none">
        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        <span className="text-white font-bold text-sm">جاري المعالجة...</span>
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="w-full h-14 bg-green-600 flex items-center justify-center gap-2 rounded-none">
        <CheckCircle2 className="h-5 w-5 text-white" />
        <span className="text-white font-black uppercase tracking-widest text-[11px]">تمت الموافقة</span>
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      <button
        onClick={handleClick}
        className="w-full h-14 bg-black text-white font-bold rounded-none flex items-center justify-center gap-3 hover:bg-black/80 transition-all active:scale-95"
      >
        <ApplePayLogo className="h-8 object-contain brightness-0 invert" />
      </button>
      <p className="text-[9px] text-center text-black/30 font-bold">محاكاة Apple Pay — لا يوجد خصم فعلي من بطاقتك</p>
    </div>
  );
}
