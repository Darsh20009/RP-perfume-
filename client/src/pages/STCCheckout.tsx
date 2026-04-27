import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCart } from "@/hooks/use-cart";
import { CheckCircle2, XCircle, Phone, RefreshCw, Shield, Clock, Smartphone } from "lucide-react";
import { STCPayLogo } from "@/components/payment/PaymentBrands";
import { cn } from "@/lib/utils";
import { RiyalSign } from "@/components/RiyalSign";

export default function STCCheckout() {
  const [, setLocation] = useLocation();
  const { clearCart } = useCart();

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId") || "";
  const amount = parseFloat(params.get("amount") || "0");

  const [step, setStep] = useState<"phone" | "otp" | "success" | "failed">("phone");
  const [phone, setPhone] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!orderId || !amount) setLocation("/");
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(t);
  }, [timeLeft]);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    if (digits.length > 7) return digits.slice(0, 4) + " " + digits.slice(4, 7) + " " + digits.slice(7);
    if (digits.length > 4) return digits.slice(0, 4) + " " + digits.slice(4);
    return digits;
  };

  const handleSendOTP = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setError("أدخل رقم جوال سعودي صحيح (10 أرقام)"); return; }
    setIsLoading(true); setError("");
    try {
      const res = await fetch("/api/pay/stc/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amount, phone: digits }),
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || "فشل إرسال رمز التحقق"); return; }
      setSessionToken(data.sessionToken);
      setStep("otp");
      setTimeLeft(300);
      setTimeout(() => inputRefs.current[0]?.focus(), 200);
    } catch { setError("خطأ في الاتصال، حاول مجدداً"); }
    finally { setIsLoading(false); }
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
    setIsLoading(true); setError("");
    try {
      const res = await fetch("/api/pay/stc/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, otp: otpCode }),
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || "رمز التحقق غير صحيح");
        setOtp(["", "", "", ""]);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
        return;
      }
      if (orderId) {
        try {
          await apiRequest("PATCH", `/api/orders/${orderId}`, { paymentStatus: "paid", paymentTransactionId: data.transactionId });
        } catch { }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      clearCart();
      setStep("success");
    } catch { setError("خطأ في التحقق، حاول مجدداً"); }
    finally { setIsLoading(false); }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (step === "success") {
    return (
      <Layout>
        <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-4" dir="rtl">
          <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-6 shadow-sm">
            <div className="w-20 h-20 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="font-black text-2xl text-[#2B2B60]">تمت العملية بنجاح!</h2>
              <p className="text-sm text-gray-800 font-bold mt-1">تم خصم {amount.toLocaleString()} <RiyalSign /> من محفظة STC Pay</p>
            </div>
            <div className="flex justify-center">
              <STCPayLogo className="h-10" />
            </div>
            <button
              onClick={() => setLocation("/orders")}
              className="w-full h-12 font-black uppercase tracking-widest text-[10px] text-white flex items-center justify-center gap-2 transition-all rounded-xl"
              style={{ background: "linear-gradient(135deg, #7B2D8B, #3D1458)" }}
            >
              عرض طلباتي
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (step === "failed") {
    return (
      <Layout>
        <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-4" dir="rtl">
          <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-6 shadow-sm">
            <XCircle className="h-16 w-16 text-red-500 mx-auto" />
            <h2 className="font-black text-2xl text-[#2B2B60]">فشلت العملية</h2>
            <p className="text-sm text-red-500 font-bold">{error}</p>
            <button onClick={() => setStep("phone")} className="w-full h-12 font-black uppercase tracking-widest text-[10px] text-white rounded-xl" style={{ background: "linear-gradient(135deg, #7B2D8B, #3D1458)" }}>إعادة المحاولة</button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#FFFFFF]" dir="rtl">
        <div className="container max-w-md py-12 px-4 space-y-6">

          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <STCPayLogo className="h-14" />
            </div>
            <p className="text-sm text-gray-800 font-bold">محفظة STC للدفع الإلكتروني</p>
          </div>

          <div className="border border-purple-200 rounded-2xl p-6 text-center bg-gradient-to-br from-purple-50 to-purple-100/50">
            <div className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2">المبلغ المطلوب</div>
            <div className="text-5xl font-black text-[#2B2B60] tracking-tighter">{amount.toLocaleString()}</div>
            <div className="text-sm font-bold text-gray-800 mt-1">ريال سعودي</div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm">
            {step === "phone" && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-700">رقم جوال STC Pay</label>
                  <div className="relative">
                    <input
                      type="tel"
                      placeholder="05XX XXX XXX"
                      value={phone}
                      onChange={(e) => { setPhone(formatPhone(e.target.value)); setError(""); }}
                      onKeyDown={(e) => e.key === "Enter" && handleSendOTP()}
                      className="w-full h-14 bg-gray-50 border border-gray-200 rounded-xl text-[#2B2B60] font-mono text-lg px-4 pr-12 text-right outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                      dir="ltr"
                    />
                    <Phone className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-700" />
                  </div>
                  {error && <p className="text-[11px] text-red-500 font-bold">{error}</p>}
                </div>

                <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-[10px] text-gray-800 font-bold">
                  للاختبار: أدخل أي رقم سعودي — رمز OTP التجريبي هو <span className="font-black text-purple-600">1234</span>
                </div>

                <button
                  onClick={handleSendOTP}
                  disabled={isLoading || phone.replace(/\D/g, "").length < 10}
                  className="w-full h-14 font-black uppercase tracking-[0.3em] text-[11px] text-white disabled:opacity-40 flex items-center justify-center gap-2 transition-all rounded-xl"
                  style={{ background: "linear-gradient(135deg, #7B2D8B, #3D1458)" }}
                >
                  {isLoading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> جاري الإرسال...</>
                    : <><Phone className="h-4 w-4" /> إرسال رمز التحقق</>
                  }
                </button>
              </div>
            )}

            {step === "otp" && (
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-gray-800">تم إرسال رمز التحقق إلى</p>
                  <p className="font-black text-lg text-[#2B2B60]" dir="ltr">{phone}</p>
                  <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <p className="text-[10px] text-amber-700 font-bold">رمز التحقق التجريبي: <span className="font-black text-amber-900">1234</span></p>
                  </div>
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
                      disabled={isLoading}
                      className={cn(
                        "w-14 h-16 text-center text-3xl font-black border rounded-xl outline-none transition-all bg-gray-50 text-[#2B2B60]",
                        digit ? "border-purple-400 bg-purple-50" : "border-gray-200",
                        error ? "border-red-400 bg-red-50" : "",
                        "focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                      )}
                    />
                  ))}
                </div>

                {error && <p className="text-center text-xs font-bold text-red-500">{error}</p>}

                {isLoading && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
                    <span className="text-xs font-bold text-gray-700">جاري التحقق...</span>
                  </div>
                )}

                <div className="text-center">
                  {timeLeft > 0 ? (
                    <p className="text-xs font-bold text-gray-700">
                      ينتهي الرمز خلال{" "}
                      <span className={cn("font-black", timeLeft < 60 ? "text-red-500" : "text-purple-600")}>
                        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                      </span>
                    </p>
                  ) : (
                    <button onClick={() => { setStep("phone"); setOtp(["", "", "", ""]); }} className="flex items-center gap-1 text-xs font-black text-purple-600 hover:underline mx-auto">
                      <RefreshCw className="h-3 w-3" /> إعادة الإرسال
                    </button>
                  )}
                </div>

                <button onClick={() => { setStep("phone"); setOtp(["", "", "", ""]); }} className="w-full text-xs font-black text-gray-700 hover:text-gray-800 transition-colors">
                  تغيير رقم الجوال
                </button>
              </div>
            )}
          </div>

          <div className="flex justify-center gap-6">
            {[
              { icon: Shield, label: "دفع آمن" },
              { icon: Clock, label: "فوري" },
              { icon: Smartphone, label: "بلا أوراق" },
            ].map(b => (
              <div key={b.label} className="text-center space-y-1">
                <div className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center mx-auto bg-white shadow-sm">
                  <b.icon className="h-4 w-4 text-purple-500" />
                </div>
                <span className="text-[9px] font-black text-gray-700">{b.label}</span>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-center text-gray-700 font-bold">
            هذه محاكاة لتجربة STC Pay الحقيقية • لا يوجد خصم فعلي
          </p>
        </div>
      </div>
    </Layout>
  );
}
