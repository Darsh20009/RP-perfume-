import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCart } from "@/hooks/use-cart";
import {
  ArrowRight, X, CheckCircle2, ChevronLeft,
  FileText, CreditCard, Phone, Shield, Smartphone
} from "lucide-react";

type Step = "phone" | "otp" | "terms" | "national_id" | "plan" | "processing" | "success" | "cancelled";
type PlanOption = 2 | 3 | 4;

const TAMARA_PURPLE = "#4B1E78";
const TAMARA_LIGHT = "#F3EEFB";
const TAMARA_ACCENT = "#FF6B35";
const TEST_PHONE = "+966 50 000 0000";
const TEST_OTP = "1234";

function TamaraLogoSvg({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <svg viewBox="0 0 48 48" fill="none" className="h-8 w-8">
        <rect width="48" height="48" rx="12" fill={TAMARA_PURPLE} />
        <path d="M24 12L36 20V32L24 40L12 32V20L24 12Z" fill="white" opacity="0.9" />
        <path d="M24 18L31 22.5V31.5L24 36L17 31.5V22.5L24 18Z" fill={TAMARA_PURPLE} />
        <circle cx="24" cy="27" r="4" fill="white" />
      </svg>
      <span className="font-black text-xl" style={{ color: TAMARA_PURPLE }}>tamara</span>
    </div>
  );
}

export default function TamaraCheckout() {
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
  const [selectedPlan, setSelectedPlan] = useState<PlanOption>(3);
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
      d.setMonth(d.getMonth() + i);
      return i === 0 ? "اليوم" : d.toLocaleDateString("ar-SA", { month: "long", day: "numeric" });
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
    if (otpValues.join("") !== TEST_OTP) { setOtpError(true); return; }
    setStep("terms");
  };

  const handleConfirm = async () => {
    setStep("processing");
    try {
      await new Promise(r => setTimeout(r, 2000));
      await fetch("/api/payments/tamara/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
        credentials: "include",
      });
      if (orderId) {
        try {
          await apiRequest("PATCH", `/api/orders/${orderId}`, {
            paymentStatus: "paid",
            paymentTransactionId: `TAMARA-${Date.now()}`,
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

  const stepIndex: Record<Step, number> = {
    phone: 0, otp: 1, terms: 2, national_id: 3, plan: 4,
    processing: 5, success: 5, cancelled: 5,
  };
  const totalSteps = 5;

  if (step === "success") {
    const { installmentAmount, dates } = getPlanDetails(selectedPlan);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: TAMARA_LIGHT }}>
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg"
              style={{ background: TAMARA_PURPLE }}
            >
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-2xl font-black mb-1" style={{ color: TAMARA_PURPLE }}>تمت الموافقة!</h2>
            <p className="text-gray-500 text-sm">وافقت tamara على طلبك بنجاح</p>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm" dir="rtl">
            <div className="flex items-center justify-between mb-4">
              <TamaraLogoSvg />
              <span className="text-xs font-bold px-3 py-1 rounded-full text-white" style={{ background: "#22c55e" }}>
                مدفوع ✓
              </span>
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-bold text-gray-400 mb-3">جدول السداد — {selectedPlan} دفعات</p>
              {dates.map((date, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: i === 0 ? TAMARA_LIGHT : "#f9f9f9" }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                      style={{ background: i === 0 ? TAMARA_PURPLE : "#e5e7eb", color: i === 0 ? "#fff" : "#6b7280" }}
                    >
                      {i + 1}
                    </div>
                    <span className="font-bold text-sm" style={{ color: i === 0 ? TAMARA_PURPLE : "#374151" }}>
                      {installmentAmount.toLocaleString()} ر.س
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">{date}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => setLocation("/orders")}
            className="w-full h-14 rounded-2xl font-black text-white flex items-center justify-center gap-2 shadow-lg transition-opacity hover:opacity-90"
            style={{ background: TAMARA_PURPLE }}
          >
            عرض طلباتي
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: TAMARA_LIGHT }}>
        <div className="w-16 h-16 rounded-full border-4 animate-spin" style={{ borderColor: TAMARA_LIGHT, borderTopColor: TAMARA_PURPLE }} />
        <TamaraLogoSvg />
        <p className="text-sm font-medium" style={{ color: TAMARA_PURPLE }}>جاري معالجة طلبك...</p>
      </div>
    );
  }

  const stepLabels = ["الهاتف", "التحقق", "الشروط", "الهوية", "الخطة"];
  const currentStepIndex = stepIndex[step];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: TAMARA_LIGHT }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-16 bg-white shadow-sm" dir="rtl">
        <button
          onClick={() => setShowCancelDialog(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <X className="h-5 w-5 text-gray-500" />
        </button>
        <TamaraLogoSvg />
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
          <ArrowRight className="h-5 w-5 text-gray-500" />
        </button>
      </div>

      {/* Steps indicator */}
      <div className="bg-white border-b border-gray-100 px-5 pb-4 pt-2">
        <div className="flex items-center gap-1 max-w-sm mx-auto">
          {stepLabels.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors"
                  style={{
                    background: i < currentStepIndex ? TAMARA_PURPLE : i === currentStepIndex ? TAMARA_PURPLE : "#e5e7eb",
                    color: i <= currentStepIndex ? "#fff" : "#9ca3af"
                  }}
                >
                  {i < currentStepIndex ? "✓" : i + 1}
                </div>
                <span className="text-[9px] font-bold whitespace-nowrap" style={{ color: i <= currentStepIndex ? TAMARA_PURPLE : "#9ca3af" }}>
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className="flex-1 h-0.5 mb-4 mx-1 transition-colors" style={{ background: i < currentStepIndex ? TAMARA_PURPLE : "#e5e7eb" }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-5 py-6" dir="rtl">

        {/* Step 1: Phone */}
        {step === "phone" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style={{ background: TAMARA_PURPLE }}>
                <Phone className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-black mb-2" style={{ color: TAMARA_PURPLE }}>رقم جوالك</h1>
              <p className="text-gray-500 text-sm leading-relaxed">أدخل رقم جوالك المسجّل مع tamara للمتابعة</p>
            </div>
            <div className="mb-5">
              <label className="text-xs font-bold text-gray-500 mb-2 block">رقم الجوال</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full h-14 px-4 bg-white border-2 rounded-2xl text-base font-medium outline-none transition-colors shadow-sm"
                  style={{ borderColor: phone.length > 5 ? TAMARA_PURPLE : "#e5e7eb", color: TAMARA_PURPLE, direction: "ltr" }}
                  placeholder="+966 5X XXX XXXX"
                />
              </div>
            </div>
            <button
              onClick={() => { setResendTimer(59); setStep("otp"); }}
              disabled={phone.replace(/\s/g, "").length < 10}
              className="w-full h-14 rounded-2xl font-black text-white text-base transition-opacity disabled:opacity-40 shadow-md"
              style={{ background: TAMARA_PURPLE }}
            >
              إرسال رمز التحقق
            </button>
            <div className="mt-auto pt-8 text-center">
              <p className="text-xs text-gray-400 mb-2">رقم تجريبي للاختبار</p>
              <button
                onClick={() => setPhone(TEST_PHONE)}
                className="text-sm font-bold px-5 py-2.5 rounded-full border-2 border-dashed hover:bg-white transition-colors shadow-sm"
                style={{ borderColor: TAMARA_PURPLE, color: TAMARA_PURPLE }}
              >
                {TEST_PHONE}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: OTP */}
        {step === "otp" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style={{ background: TAMARA_PURPLE }}>
                <Smartphone className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-black mb-2" style={{ color: TAMARA_PURPLE }}>رمز التحقق</h1>
              <p className="text-gray-500 text-sm">أرسلنا رمزاً مكوناً من 4 أرقام إلى</p>
              <p className="font-black text-sm mt-1" style={{ color: TAMARA_PURPLE, direction: "ltr", textAlign: "right" }}>{phone}</p>
            </div>
            <div className="flex gap-3 justify-center mb-3" dir="ltr">
              {otpValues.map((v, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={v}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  className="w-14 h-16 text-center text-2xl font-black border-2 rounded-2xl outline-none transition-colors bg-white shadow-sm"
                  style={{
                    borderColor: otpError ? "#ef4444" : v ? TAMARA_PURPLE : "#e5e7eb",
                    color: TAMARA_PURPLE
                  }}
                />
              ))}
            </div>
            {otpError && (
              <p className="text-center text-sm text-red-500 font-bold mb-3">رمز التحقق غير صحيح</p>
            )}
            <div className="text-center mb-5">
              {resendTimer > 0 ? (
                <p className="text-gray-400 text-sm">إعادة الإرسال بعد <span className="font-bold">{resendTimer}s</span></p>
              ) : (
                <button
                  onClick={() => setResendTimer(59)}
                  className="text-sm font-bold underline"
                  style={{ color: TAMARA_PURPLE }}
                >
                  إعادة إرسال الرمز
                </button>
              )}
            </div>
            <button
              onClick={handleOtpVerify}
              disabled={otpValues.join("").length < 4}
              className="w-full h-14 rounded-2xl font-black text-white text-base transition-opacity disabled:opacity-40 shadow-md"
              style={{ background: TAMARA_PURPLE }}
            >
              تحقق وتابع
            </button>
            <div className="mt-auto pt-8 text-center">
              <p className="text-xs text-gray-400 mb-2">رمز تجريبي للاختبار</p>
              <button
                onClick={() => setOtpValues(TEST_OTP.split(""))}
                className="text-sm font-bold px-5 py-2.5 rounded-full border-2 border-dashed hover:bg-white transition-colors shadow-sm"
                style={{ borderColor: TAMARA_PURPLE, color: TAMARA_PURPLE }}
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
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style={{ background: TAMARA_PURPLE }}>
                <FileText className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-black mb-2" style={{ color: TAMARA_PURPLE }}>الموافقة على الشروط</h1>
              <p className="text-gray-500 text-sm leading-relaxed">يرجى مراجعة والموافقة على الشروط التالية للمتابعة</p>
            </div>
            <div className="space-y-3 flex-1">
              {[
                { label: "أوافق على شروط الاستخدام وسياسة الخصوصية الخاصة بـ tamara", sub: "عرض الشروط والأحكام" },
                { label: "أوافق على الاستعلام عن بياناتي الائتمانية لتقييم الأهلية", sub: "معرفة المزيد" },
                { label: "أؤكد أن جميع معلوماتي صحيحة ودقيقة", sub: null },
              ].map((term, i) => (
                <div
                  key={i}
                  onClick={() => {
                    const n = [...termsChecked];
                    n[i] = !n[i];
                    setTermsChecked(n);
                  }}
                  className="flex gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all bg-white shadow-sm"
                  style={{ borderColor: termsChecked[i] ? TAMARA_PURPLE : "#e5e7eb" }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors border-2"
                    style={{
                      borderColor: termsChecked[i] ? TAMARA_PURPLE : "#d1d5db",
                      background: termsChecked[i] ? TAMARA_PURPLE : "transparent"
                    }}
                  >
                    {termsChecked[i] && <span className="text-[10px] font-black text-white">✓</span>}
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-relaxed text-gray-700">{term.label}</p>
                    {term.sub && <p className="text-xs mt-1 underline" style={{ color: TAMARA_PURPLE }}>{term.sub}</p>}
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setStep("national_id")}
              disabled={!termsChecked.every(Boolean)}
              className="w-full h-14 rounded-2xl font-black text-white text-base mt-5 transition-opacity disabled:opacity-40 shadow-md"
              style={{ background: TAMARA_PURPLE }}
            >
              موافق ومتابعة
            </button>
          </div>
        )}

        {/* Step 4: National ID */}
        {step === "national_id" && (
          <div className="flex-1 flex flex-col">
            <div className="mb-6">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style={{ background: TAMARA_PURPLE }}>
                <Shield className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-black mb-2" style={{ color: TAMARA_PURPLE }}>الهوية الوطنية</h1>
              <p className="text-gray-500 text-sm leading-relaxed">أدخل رقم هويتك الوطنية أو رقم الإقامة</p>
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <label className="text-xs font-black mb-2 block" style={{ color: TAMARA_PURPLE }}>رقم الهوية / الإقامة</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={nationalId}
                  onChange={e => {
                    setNationalId(e.target.value.replace(/\D/g, "").slice(0, 10));
                    setNationalIdError("");
                  }}
                  className="w-full h-14 px-4 bg-white border-2 rounded-2xl text-lg font-mono outline-none transition-colors shadow-sm"
                  style={{
                    borderColor: nationalIdError ? "#ef4444" : nationalId.length >= 9 ? TAMARA_PURPLE : "#e5e7eb",
                    color: TAMARA_PURPLE, direction: "ltr"
                  }}
                  placeholder="1XXXXXXXXX"
                  maxLength={10}
                />
                {nationalIdError && <p className="text-red-500 text-xs mt-1.5 font-bold">{nationalIdError}</p>}
              </div>
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: TAMARA_LIGHT }}>
                    <span className="text-base">🔒</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold mb-0.5" style={{ color: TAMARA_PURPLE }}>بياناتك آمنة تماماً</p>
                    <p className="text-xs text-gray-500 leading-relaxed">نستخدم تشفيراً عالي المستوى لحماية معلوماتك الشخصية</p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (nationalId.length < 9) { setNationalIdError("يرجى إدخال رقم هوية صحيح (9-10 أرقام)"); return; }
                setStep("plan");
              }}
              disabled={nationalId.length < 9}
              className="w-full h-14 rounded-2xl font-black text-white text-base mt-5 transition-opacity disabled:opacity-40 shadow-md"
              style={{ background: TAMARA_PURPLE }}
            >
              متابعة
            </button>
            <div className="mt-4 text-center">
              <p className="text-xs text-gray-400 mb-2">رقم تجريبي</p>
              <button
                onClick={() => setNationalId("1234567890")}
                className="text-sm font-bold px-5 py-2 rounded-full border-2 border-dashed hover:bg-white transition-colors"
                style={{ borderColor: TAMARA_PURPLE, color: TAMARA_PURPLE }}
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
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-sm" style={{ background: TAMARA_PURPLE }}>
                <CreditCard className="h-7 w-7 text-white" />
              </div>
              <h1 className="text-2xl font-black mb-1" style={{ color: TAMARA_PURPLE }}>اختر خطة الدفع</h1>
              <p className="text-gray-500 text-sm">قسّط <span className="font-bold" style={{ color: TAMARA_PURPLE }}>{amount.toLocaleString()} ر.س</span> بدون فوائد</p>
            </div>
            <div className="space-y-3 flex-1">
              {([2, 3, 4] as PlanOption[]).map(plan => {
                const perInstallment = (amount / plan).toFixed(2);
                const isSelected = selectedPlan === plan;
                return (
                  <div
                    key={plan}
                    onClick={() => setSelectedPlan(plan)}
                    className="p-5 rounded-2xl border-2 cursor-pointer transition-all bg-white shadow-sm"
                    style={{ borderColor: isSelected ? TAMARA_PURPLE : "#e5e7eb" }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-5 h-5 rounded-full flex items-center justify-center border-2 transition-colors"
                          style={{
                            borderColor: isSelected ? TAMARA_PURPLE : "#d1d5db",
                            background: isSelected ? TAMARA_PURPLE : "transparent"
                          }}
                        >
                          {isSelected && <span className="text-[10px] font-black text-white">✓</span>}
                        </div>
                        <span className="font-black text-base" style={{ color: TAMARA_PURPLE }}>{plan} دفعات</span>
                      </div>
                      {isSelected && (
                        <span
                          className="text-xs font-black px-2.5 py-1 rounded-full text-white"
                          style={{ background: TAMARA_PURPLE }}
                        >
                          مختار
                        </span>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5 mr-8 mb-3">
                      <span className="text-3xl font-black" style={{ color: isSelected ? TAMARA_PURPLE : "#374151" }}>
                        {parseFloat(perInstallment).toLocaleString()}
                      </span>
                      <span className="text-gray-500 text-sm font-bold">ر.س / شهر</span>
                    </div>
                    <div className="flex items-center gap-1.5 mr-8">
                      {Array.from({ length: plan }).map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 h-2 rounded-full transition-colors"
                          style={{ background: isSelected ? (i === 0 ? TAMARA_PURPLE : TAMARA_LIGHT) : "#f3f4f6" }}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-3">
              <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">الدفعة الأولى الآن</span>
                  <span className="font-black" style={{ color: TAMARA_PURPLE }}>
                    {(amount / selectedPlan).toFixed(2)} ر.س
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>الدفعات التالية</span>
                  <span>{selectedPlan - 1} × {(amount / selectedPlan).toFixed(2)} ر.س</span>
                </div>
              </div>
              <button
                onClick={handleConfirm}
                className="w-full h-14 rounded-2xl font-black text-white text-base flex items-center justify-center gap-2 transition-opacity hover:opacity-90 shadow-lg"
                style={{ background: TAMARA_PURPLE }}
              >
                تأكيد الدفع
                <span className="opacity-80 text-sm">— {(amount / selectedPlan).toFixed(2)} ر.س الآن</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Cancel dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: TAMARA_LIGHT }}>
              <X className="h-7 w-7" style={{ color: TAMARA_PURPLE }} />
            </div>
            <h3 className="text-xl font-black text-center" style={{ color: TAMARA_PURPLE }}>إلغاء الدفع؟</h3>
            <p className="text-gray-500 text-sm text-center leading-relaxed">
              سيتم إلغاء عملية الدفع والعودة إلى السلة
            </p>
            <div className="space-y-2 pt-2">
              <button
                onClick={handleCancel}
                className="w-full h-12 rounded-2xl font-black text-sm text-white transition-opacity hover:opacity-90"
                style={{ background: "#ef4444" }}
              >
                نعم، إلغاء الدفع
              </button>
              <button
                onClick={() => setShowCancelDialog(false)}
                className="w-full h-12 rounded-2xl font-black text-sm border-2 transition-colors hover:bg-gray-50"
                style={{ borderColor: TAMARA_PURPLE, color: TAMARA_PURPLE }}
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
