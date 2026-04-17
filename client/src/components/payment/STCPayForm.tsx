import { useState, useRef, useEffect } from "react";
import { Phone, Smartphone, RefreshCw, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface STCPayFormProps {
  orderId: string;
  amount: number;
  onSuccess: (transactionId: string, receipt: any) => void;
  onError: (msg: string) => void;
}

type Step = "phone" | "otp" | "processing";

export function STCPayForm({ orderId, amount, onSuccess, onError }: STCPayFormProps) {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    if (digits.length > 4) return digits.slice(0, 4) + " " + digits.slice(4, 7) + " " + digits.slice(7);
    return digits;
  };

  const handleSendOTP = async () => {
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) { setError("أدخل رقم جوال سعودي صحيح"); return; }

    setLoading(true); setError("");
    try {
      const res = await fetch("/api/pay/stc/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amount, phone: phoneDigits }),
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "فشل إرسال OTP"); return; }
      setSessionToken(data.sessionToken);
      setStep("otp");
      setTimeLeft(300);
      setTimeout(() => inputRefs.current[0]?.focus(), 200);
    } catch { setError("خطأ في الاتصال، حاول مجدداً"); }
    finally { setLoading(false); }
  };

  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError("");
    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d !== "") && digit) handleVerify(newOtp.join(""));
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) inputRefs.current[index - 1]?.focus();
  };

  const handleVerify = async (otpCode: string) => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/pay/stc/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, otp: otpCode }),
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "رمز OTP غير صحيح");
        setOtp(["", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
        return;
      }
      setStep("processing");
      setTimeout(() => onSuccess(data.transactionId, data.receipt), 1000);
    } catch { setError("خطأ في التحقق"); }
    finally { setLoading(false); }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="space-y-6" dir="rtl">
      {/* STC Pay Logo */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-[#6D0A1C] to-[#A01025] rounded-xl">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Smartphone className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="font-black text-white text-sm">STC Pay</div>
          <div className="text-[10px] text-white/60 font-bold">محفظة STC للدفع الإلكتروني</div>
        </div>
        <div className="mr-auto font-black text-white text-lg">{amount.toLocaleString()} ر.س</div>
      </div>

      {step === "phone" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-black/40">رقم جوال STC Pay</label>
            <div className="relative">
              <Input
                type="tel"
                placeholder="05XX XXX XXX"
                value={phone}
                onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                className="h-14 text-lg font-mono border-2 border-black/10 bg-white pr-12 text-right"
                dir="ltr"
              />
              <Phone className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-black/20" />
            </div>
            {error && <p className="text-[11px] text-red-500 font-bold">{error}</p>}
          </div>
          <p className="text-[10px] text-black/30 font-bold bg-gray-50 border border-black/5 rounded p-3">
            للاختبار: أدخل أي رقم سعودي — سيصلك OTP وهمي هو <span className="font-black text-primary">1234</span>
          </p>
          <button
            onClick={handleSendOTP}
            disabled={loading || phone.replace(/\D/g, "").length < 10}
            className="w-full h-14 bg-[#6D0A1C] text-white font-black uppercase tracking-[0.3em] text-[11px] disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-[#A01025] transition-colors"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Phone className="h-4 w-4" />}
            {loading ? "جاري الإرسال..." : "إرسال رمز التحقق"}
          </button>
        </div>
      )}

      {step === "otp" && (
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <p className="text-sm font-bold text-black/60">تم الإرسال إلى</p>
            <p className="font-black text-lg" dir="ltr">{phone}</p>
            <p className="text-[10px] text-black/30 font-bold bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
              رمز التحقق للاختبار: <span className="font-black text-yellow-700">1234</span>
            </p>
          </div>

          <div className="flex justify-center gap-3" dir="ltr">
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className={cn(
                  "w-14 h-16 text-center text-3xl font-black border-2 rounded-xl outline-none transition-all",
                  digit ? "border-[#6D0A1C] bg-[#6D0A1C]/5 text-[#6D0A1C]" : "border-black/10 bg-gray-50",
                  error ? "border-red-400 bg-red-50" : "",
                  "focus:border-[#6D0A1C] focus:bg-[#6D0A1C]/5"
                )}
              />
            ))}
          </div>

          {error && <p className="text-center text-xs font-bold text-red-500">{error}</p>}

          {loading && (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-[#6D0A1C]/30 border-t-[#6D0A1C] rounded-full animate-spin" />
              <span className="text-xs font-bold text-black/50">جاري التحقق...</span>
            </div>
          )}

          <div className="text-center">
            {timeLeft > 0 ? (
              <p className="text-xs font-bold text-black/40">
                ينتهي الرمز خلال{" "}
                <span className={cn("font-black", timeLeft < 60 ? "text-red-500" : "text-[#6D0A1C]")}>
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </span>
              </p>
            ) : (
              <button
                onClick={() => { setStep("phone"); setOtp(["", "", "", ""]); }}
                className="flex items-center gap-1 text-xs font-black text-[#6D0A1C] hover:underline mx-auto"
              >
                <RefreshCw className="h-3 w-3" /> إعادة الإرسال
              </button>
            )}
          </div>

          <button
            onClick={() => setStep("phone")}
            className="w-full text-xs font-black text-black/30 hover:text-black/60"
          >
            تغيير رقم الجوال
          </button>
        </div>
      )}

      {step === "processing" && (
        <div className="py-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-green-600 animate-pulse" />
          </div>
          <p className="font-black text-lg">تمت العملية بنجاح!</p>
          <p className="text-xs text-black/40 font-bold">جاري تأكيد طلبك...</p>
        </div>
      )}
    </div>
  );
}
