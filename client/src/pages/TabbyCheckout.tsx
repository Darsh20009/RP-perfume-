import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCart } from "@/hooks/use-cart";
import {
  ArrowLeft, X, CheckCircle2, ChevronRight,
  FileText, CreditCard, Phone, Shield
} from "lucide-react";

type Step = "phone" | "otp" | "terms" | "national_id" | "plan" | "processing" | "success" | "cancelled";
type PlanOption = 2 | 4 | 6;

const TABBY_PRIMARY = "#182430";
const TABBY_GREEN = "#3bff9d";
const TEST_PHONE = "+966 50 000 0000";
const TEST_OTP = "1234";

export default function TabbyCheckout() {
  const [, setLocation] = useLocation();
  const { clearCart } = useCart();

  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session") || "";
  const amount = parseFloat(params.get("amount") || "0");
  const orderId = params.get("orderId") || "";

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("+966 ");
  const [otpValues, setOtpValues] = useState(["", "", "", ""]);
  const [otpError, setOtpError] = useState(false);
  const [nationalId, setNationalId] = useState("");
  const [nationalIdError, setNationalIdError] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>(4);
  const [termsChecked, setTermsChecked] = useState([false, false, false]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [resendTimer, setResendTimer] = useState(59);
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    let t: any;
    if (step === "otp" && resendTimer > 0) {
      t = setTimeout(() => setResendTimer(r => r - 1), 1000);
    }
    return () => clearTimeout(t);
  }, [step, resendTimer]);

  const getPlanDetails = (plan: PlanOption) => {
    const installmentAmount = (amount / plan).toFixed(2);
    const dates = Array.from({ length: plan }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i * 30);
      return i === 0 ? "اليوم" : d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
    });
    return { installmentAmount: parseFloat(installmentAmount), dates };
  };

  const handleOtpChange = (i: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otpValues];
    next[i] = val.slice(-1);
    setOtpValues(next);
    setOtpError(false);
    if (val && i < 3) otpRefs[i + 1].current?.focus();
    if (!val && i > 0) otpRefs[i - 1].current?.focus();
  };

  const handleOtpVerify = () => {
    const code = otpValues.join("");
    if (code !== TEST_OTP) { setOtpError(true); return; }
    setStep("terms");
  };

  const handleConfirm = async () => {
    setStep("processing");
    try {
      await new Promise(r => setTimeout(r, 2000));
      const res = await fetch("/api/payments/tabby/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        credentials: "include",
      });
      if (orderId) {
        try {
          await apiRequest("PATCH", `/api/orders/${orderId}`, {
            paymentStatus: "paid",
            paymentTransactionId: `TABBY-${Date.now()}`,
          });
        } catch { }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      clearCart();
      setStep("success");
    } catch {
      setStep("success");
    }
  };

  const handleCancel = () => {
    setShowCancelDialog(false);
    clearCart();
    setLocation("/cart");
  };

  const { installmentAmount, dates } = getPlanDetails(selectedPlan);

  const stepIndex: Record<Step, number> = {
    phone: 0, otp: 1, terms: 2, national_id: 3, plan: 4,
    processing: 5, success: 5, cancelled: 5,
  };
  const totalSteps = 5;

  if (step === "success") {
    const { installmentAmount: ia, dates: ds } = getPlanDetails(selectedPlan);
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: TABBY_GREEN }}>
            <CheckCircle2 className="h-10 w-10" style={{ color: TABBY_PRIMARY }} />
          </div>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: TABBY_PRIMARY }}>تمت الموافقة!</h2>
            <p className="text-gray-500 text-sm mt-1">تابي وافقت على طلب التقسيط بنجاح</p>
          </div>
          <div className="rounded-2xl p-5 space-y-3 text-right" style={{ background: "#f2f5f7" }}>
            <p className="text-xs font-bold text-gray-500 mb-3">جدول السداد — {selectedPlan} دفعات</p>
            {ds.map((date, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: i === 0 ? TABBY_GREEN : "#e0e9f0", color: i === 0 ? TABBY_PRIMARY : "#7f8b99" }}>
                    {i + 1}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: i === 0 ? TABBY_PRIMARY : "#7f8b99" }}>
                    {ia.toLocaleString()} ر.س
                  </span>
                </div>
                <span className="text-xs text-gray-400">{date}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setLocation("/orders")}
            className="w-full h-14 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-80"
            style={{ background: TABBY_PRIMARY, color: "#fff" }}
          >
            عرض طلباتي
            <ChevronRight className="h-4 w-4 rotate-180" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 rounded-full border-4 border-gray-100 border-t-transparent animate-spin"
          style={{ borderTopColor: TABBY_GREEN }} />
        <p className="text-gray-500 font-medium text-sm">جاري معالجة طلبك...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ fontFamily: "Inter, Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100" style={{ background: "#fff" }}>
        <button
          onClick={() => {
            if (step === "phone") setShowCancelDialog(true);
            else {
              const prev: Record<Step, Step> = {
                phone: "phone", otp: "phone", terms: "otp",
                national_id: "terms", plan: "national_id",
                processing: "plan", success: "plan", cancelled: "phone"
              };
              setStep(prev[step]);
            }
          }}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>

        <div className="flex items-center gap-1.5">
          <div className="font-bold text-xl" style={{ color: TABBY_PRIMARY }}>tabby</div>
          <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: TABBY_GREEN }}>
            <span className="text-[10px] font-bold" style={{ color: TABBY_PRIMARY }}>✓</span>
          </div>
        </div>

        <button
          onClick={() => setShowCancelDialog(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${((stepIndex[step] + 1) / totalSteps) * 100}%`, background: TABBY_GREEN }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-5 py-8">

        {/* Step 1: Phone */}
        {step === "phone" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-8">
              <h1 className="text-2xl font-bold mb-2" style={{ color: TABBY_PRIMARY }}>رقم جوالك</h1>
              <p className="text-gray-500 text-sm">أدخل رقم الجوال المرتبط بحساب tabby</p>
            </div>
            <div className="mb-6">
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full h-14 px-4 border-2 border-gray-200 rounded-xl text-lg font-medium outline-none focus:border-gray-400 transition-colors"
                style={{ color: TABBY_PRIMARY, direction: "ltr" }}
                placeholder="+966 5X XXX XXXX"
              />
            </div>
            <button
              onClick={() => { setResendTimer(59); setStep("otp"); }}
              disabled={phone.replace(/\s/g, "").length < 10}
              className="w-full h-14 rounded-2xl font-bold text-base transition-opacity disabled:opacity-40"
              style={{ background: TABBY_PRIMARY, color: "#fff" }}
            >
              متابعة
            </button>
            <div className="mt-auto pt-8 text-center">
              <p className="text-xs text-gray-400 mb-1">رقم تجريبي</p>
              <button
                onClick={() => setPhone(TEST_PHONE)}
                className="text-sm font-bold px-4 py-2 rounded-full border border-dashed border-gray-300 hover:bg-gray-50 transition-colors"
                style={{ color: TABBY_PRIMARY }}
              >
                {TEST_PHONE}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === "otp" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-8">
              <h1 className="text-2xl font-bold mb-2" style={{ color: TABBY_PRIMARY }}>رمز التحقق</h1>
              <p className="text-gray-500 text-sm">أرسلنا رمز تحقق من 4 أرقام إلى</p>
              <p className="font-bold text-sm mt-1" style={{ color: TABBY_PRIMARY }}>{phone}</p>
            </div>
            <div className="flex gap-3 justify-center mb-2" dir="ltr">
              {otpValues.map((v, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={v}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  className="w-14 h-14 text-center text-2xl font-bold border-2 rounded-xl outline-none transition-colors"
                  style={{
                    borderColor: otpError ? "#E81E40" : v ? TABBY_GREEN : "#e0e0e0",
                    color: TABBY_PRIMARY
                  }}
                />
              ))}
            </div>
            {otpError && (
              <p className="text-center text-sm text-red-500 font-medium mb-4">رمز التحقق غير صحيح</p>
            )}
            <div className="text-center mb-6">
              {resendTimer > 0 ? (
                <p className="text-gray-400 text-sm">إعادة الإرسال بعد {resendTimer}s</p>
              ) : (
                <button onClick={() => setResendTimer(59)} className="text-sm font-bold underline" style={{ color: TABBY_PRIMARY }}>
                  إعادة إرسال الرمز
                </button>
              )}
            </div>
            <button
              onClick={handleOtpVerify}
              disabled={otpValues.join("").length < 4}
              className="w-full h-14 rounded-2xl font-bold text-base transition-opacity disabled:opacity-40"
              style={{ background: TABBY_PRIMARY, color: "#fff" }}
            >
              تحقق
            </button>
            <div className="mt-auto pt-8 text-center">
              <p className="text-xs text-gray-400 mb-1">رمز تجريبي</p>
              <button
                onClick={() => setOtpValues(TEST_OTP.split(""))}
                className="text-sm font-bold px-4 py-2 rounded-full border border-dashed border-gray-300 hover:bg-gray-50 transition-colors"
                style={{ color: TABBY_PRIMARY }}
              >
                {TEST_OTP}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Terms */}
        {step === "terms" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#f2f5f7" }}>
                <FileText className="h-6 w-6" style={{ color: TABBY_PRIMARY }} />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: TABBY_PRIMARY }}>الموافقة على الشروط</h1>
              <p className="text-gray-500 text-sm">يرجى قراءة والموافقة على الشروط التالية للمتابعة</p>
            </div>
            <div className="space-y-4 flex-1">
              {[
                { label: "أوافق على شروط الاستخدام وسياسة الخصوصية الخاصة بـ tabby", sub: "اقرأ الشروط والأحكام" },
                { label: "أوافق على استخدام بياناتي الشخصية لتقييم الائتمان", sub: "سياسة استخدام البيانات" },
                { label: "أقر بأن جميع المعلومات المقدمة صحيحة ودقيقة", sub: null },
              ].map((term, i) => (
                <div
                  key={i}
                  onClick={() => {
                    const n = [...termsChecked];
                    n[i] = !n[i];
                    setTermsChecked(n);
                  }}
                  className="flex gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all"
                  style={{ borderColor: termsChecked[i] ? TABBY_GREEN : "#e9eff5" }}
                >
                  <div
                    className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 transition-colors"
                    style={{ background: termsChecked[i] ? TABBY_GREEN : "#f2f5f7", border: `2px solid ${termsChecked[i] ? TABBY_GREEN : "#ccd6e0"}` }}
                  >
                    {termsChecked[i] && <span className="text-[10px] font-black" style={{ color: TABBY_PRIMARY }}>✓</span>}
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-relaxed" style={{ color: TABBY_PRIMARY }}>{term.label}</p>
                    {term.sub && <p className="text-xs text-gray-400 mt-1 underline">{term.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep("national_id")}
              disabled={!termsChecked.every(Boolean)}
              className="w-full h-14 rounded-2xl font-bold text-base mt-6 transition-opacity disabled:opacity-40"
              style={{ background: TABBY_PRIMARY, color: "#fff" }}
            >
              موافق ومتابعة
            </button>
          </div>
        )}

        {/* Step 4: National ID */}
        {step === "national_id" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#f2f5f7" }}>
                <Shield className="h-6 w-6" style={{ color: TABBY_PRIMARY }} />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: TABBY_PRIMARY }}>الهوية الوطنية</h1>
              <p className="text-gray-500 text-sm">أدخل رقم هويتك الوطنية أو الإقامة (Iqama)</p>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-2 block">رقم الهوية / الإقامة</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={nationalId}
                  onChange={e => {
                    setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10));
                    setNationalIdError("");
                  }}
                  className="w-full h-14 px-4 border-2 rounded-xl text-lg font-mono outline-none transition-colors"
                  style={{
                    borderColor: nationalIdError ? "#E81E40" : nationalId.length === 10 ? TABBY_GREEN : "#e0e0e0",
                    color: TABBY_PRIMARY, direction: "ltr"
                  }}
                  placeholder="1XXXXXXXXX"
                  maxLength={10}
                />
                {nationalIdError && <p className="text-red-500 text-xs mt-1.5 font-medium">{nationalIdError}</p>}
              </div>
              <div className="rounded-xl p-4 text-sm" style={{ background: "#f2f5f7" }}>
                <div className="flex gap-2 items-start">
                  <span className="text-lg">🔒</span>
                  <p className="text-gray-500">معلوماتك محمية ومشفرة. لن يتم مشاركة بياناتك مع أطراف ثالثة.</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (nationalId.length < 9) { setNationalIdError("يرجى إدخال رقم هوية صحيح (9-10 أرقام)"); return; }
                setStep("plan");
              }}
              disabled={nationalId.length < 9}
              className="w-full h-14 rounded-2xl font-bold text-base transition-opacity disabled:opacity-40"
              style={{ background: TABBY_PRIMARY, color: "#fff" }}
            >
              متابعة
            </button>
            <div className="mt-auto pt-8 text-center">
              <p className="text-xs text-gray-400 mb-1">رقم تجريبي</p>
              <button
                onClick={() => setNationalId("1234567890")}
                className="text-sm font-bold px-4 py-2 rounded-full border border-dashed border-gray-300 hover:bg-gray-50 transition-colors"
                style={{ color: TABBY_PRIMARY }}
              >
                1234567890
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Plan */}
        {step === "plan" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: "#f2f5f7" }}>
                <CreditCard className="h-6 w-6" style={{ color: TABBY_PRIMARY }} />
              </div>
              <h1 className="text-2xl font-bold mb-2" style={{ color: TABBY_PRIMARY }}>اختر خطة الدفع</h1>
              <p className="text-gray-500 text-sm">قسّط {amount.toLocaleString()} ر.س بدون فوائد</p>
            </div>
            <div className="space-y-3 flex-1">
              {([2, 4, 6] as PlanOption[]).map(plan => {
                const perInstallment = (amount / plan).toFixed(2);
                const isSelected = selectedPlan === plan;
                return (
                  <div
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    className="p-4 rounded-2xl border-2 cursor-pointer transition-all"
                    style={{ borderColor: isSelected ? TABBY_GREEN : "#e9eff5", background: isSelected ? "#f0fff8" : "#fff" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors"
                          style={{ borderColor: isSelected ? TABBY_GREEN : "#ccd6e0", background: isSelected ? TABBY_GREEN : "transparent" }}
                        >
                          {isSelected && <span className="text-[10px] font-black" style={{ color: TABBY_PRIMARY }}>✓</span>}
                        </div>
                        <span className="font-bold" style={{ color: TABBY_PRIMARY }}>{plan} دفعات</span>
                      </div>
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: isSelected ? TABBY_GREEN : "#e9eff5", color: TABBY_PRIMARY }}
                      >
                        بدون فوائد
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mr-8">
                      <span className="text-2xl font-bold" style={{ color: TABBY_PRIMARY }}>
                        {parseFloat(perInstallment).toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-sm">ر.س / شهرياً</span>
                    </div>
                    <div className="flex gap-1.5 mt-3 mr-8">
                      {Array.from({ length: plan }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 h-1.5 rounded-full"
                          style={{ background: isSelected ? (i === 0 ? TABBY_GREEN : TABBY_PRIMARY + "30") : "#e9eff5" }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              onClick={handleConfirm}
              className="w-full h-14 rounded-2xl font-bold text-base mt-6 flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ background: TABBY_PRIMARY, color: "#fff" }}
            >
              <span style={{ color: TABBY_GREEN }}>✓</span>
              تأكيد — {(amount / selectedPlan).toFixed(2)} ر.س الآن
            </button>
          </div>
        )}
      </div>

      {/* Cancel dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-2" style={{ background: "#fff0f0" }}>
              <X className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-center" style={{ color: TABBY_PRIMARY }}>إلغاء الدفع؟</h3>
            <p className="text-gray-500 text-sm text-center">إذا ألغيت الآن ستعود إلى السلة ولن يتم إتمام الطلب.</p>
            <div className="space-y-2 pt-2">
              <button
                onClick={handleCancel}
                className="w-full h-12 rounded-2xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                نعم، إلغاء الدفع
              </button>
              <button
                onClick={() => setShowCancelDialog(false)}
                className="w-full h-12 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                لا، متابعة الدفع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
