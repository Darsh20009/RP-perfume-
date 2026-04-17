import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/use-auth";
import { CardPaymentForm } from "@/components/payment/CardPaymentForm";
import { ThreeDSModal } from "@/components/payment/ThreeDSModal";
import { ApplePayButton } from "@/components/payment/ApplePayButton";
import { CardBrandsLogo, ApplePayLogo } from "@/components/payment/PaymentBrands";
import { Lock, CheckCircle2, XCircle, ChevronRight } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useCart } from "@/hooks/use-cart";

type PaymentTab = "card" | "apple";
type GatewayState = "selecting" | "processing" | "success" | "failed";

function CardTabIcon() {
  return <CardBrandsLogo className="h-6 object-contain" />;
}

function AppleTabIcon() {
  return <ApplePayLogo className="h-7 object-contain" />;
}

export default function PaymentGateway() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { clearCart } = useCart();

  const [tab, setTab] = useState<PaymentTab>("card");
  const [state, setState] = useState<GatewayState>("selecting");
  const [isCardProcessing, setIsCardProcessing] = useState(false);

  const [show3DS, setShow3DS] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [is3DSVerifying, setIs3DSVerifying] = useState(false);

  const [receipt, setReceipt] = useState<any>(null);
  const [failureMsg, setFailureMsg] = useState("");

  const orderId = new URLSearchParams(window.location.search).get("orderId");
  const amount = parseFloat(new URLSearchParams(window.location.search).get("amount") || "0");
  const orderRef = new URLSearchParams(window.location.search).get("ref") || orderId?.slice(-8).toUpperCase();

  useEffect(() => {
    if (!orderId || !amount) setLocation("/");
  }, [orderId, amount]);

  const handlePaymentSuccess = async (txId: string, rxpt: any) => {
    setReceipt(rxpt);
    if (orderId) {
      try {
        await apiRequest("PATCH", `/api/orders/${orderId}`, { paymentStatus: "paid", paymentTransactionId: txId });
      } catch { }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
    clearCart();
    setState("success");
  };

  const handlePaymentFailed = (msg: string) => {
    setFailureMsg(msg);
    setState("failed");
  };

  const handleCardSubmit = async (cardData: any) => {
    setIsCardProcessing(true);
    try {
      const res = await fetch("/api/pay/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, amount, ...cardData }),
        credentials: "include",
      });
      const data = await res.json();

      if (data.requires3DS) {
        setTransactionId(data.transactionId);
        setCardLast4(cardData.cardNumber.slice(-4));
        setShow3DS(true);
        setIsCardProcessing(false);
        return;
      }

      if (data.success) {
        const tx = await fetch(`/api/pay/transaction/${data.transactionId}`).then(r => r.json());
        await handlePaymentSuccess(data.transactionId, tx.receipt);
      } else {
        handlePaymentFailed(data.error || "تم رفض البطاقة");
      }
    } catch {
      handlePaymentFailed("خطأ في الاتصال، حاول مجدداً");
    }
    setIsCardProcessing(false);
  };

  const handle3DSVerify = async (otp: string) => {
    setIs3DSVerifying(true);
    try {
      const res = await fetch("/api/pay/card/3ds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, otp }),
        credentials: "include",
      });
      const data = await res.json();
      setShow3DS(false);
      if (data.success) {
        await handlePaymentSuccess(transactionId, data.receipt);
      } else {
        handlePaymentFailed(data.error || "فشل التحقق بخطوتين");
      }
    } catch {
      setShow3DS(false);
      handlePaymentFailed("خطأ في التحقق");
    }
    setIs3DSVerifying(false);
  };

  const TABS: { id: PaymentTab; label: string; sublabel: string; icon: () => JSX.Element }[] = [
    { id: "card", label: "بطاقة بنكية", sublabel: "مدى · فيزا · ماستركارد", icon: CardTabIcon },
    { id: "apple", label: "Apple Pay", sublabel: "Face ID / Touch ID", icon: AppleTabIcon },
  ];

  if (state === "success") {
    return (
      <Layout>
        <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-4" dir="rtl">
          <div className="max-w-sm w-full bg-white border border-black/5 shadow-2xl p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div>
              <h2 className="font-black text-2xl tracking-tight">تم الدفع بنجاح!</h2>
              <p className="text-sm text-black/40 font-bold mt-1">تم استلام طلبك وجاري التجهيز</p>
            </div>
            {receipt && (
              <div className="bg-gray-50 border border-black/5 rounded-none p-4 space-y-2 text-right" dir="ltr">
                <div className="flex justify-between text-[11px] font-bold text-black/40">
                  <span>{receipt.transactionId?.slice(0, 20)}</span>
                  <span>رقم العملية</span>
                </div>
                {receipt.authCode && (
                  <div className="flex justify-between text-[11px] font-bold text-black/40">
                    <span className="font-mono font-black text-black">{receipt.authCode}</span>
                    <span>كود الموافقة</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] font-bold text-black/40">
                  <span className="font-mono">{receipt.rrn}</span>
                  <span>RRN</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-black/5">
                  <span className="font-black text-lg text-primary">{receipt.amount?.toLocaleString()} ر.س</span>
                  <span className="font-black text-sm">المبلغ المدفوع</span>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-[10px] text-black/30 font-bold">رقم الطلب: #{orderRef}</p>
              <button
                onClick={() => setLocation("/orders")}
                className="w-full h-12 bg-black text-white font-black uppercase tracking-widest text-[10px] hover:bg-primary transition-colors flex items-center justify-center gap-2"
              >
                عرض طلباتي
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (state === "failed") {
    return (
      <Layout>
        <div className="min-h-screen bg-[#fcfcfc] flex items-center justify-center p-4" dir="rtl">
          <div className="max-w-sm w-full bg-white border border-black/5 shadow-2xl p-8 text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <div>
              <h2 className="font-black text-2xl tracking-tight">فشل الدفع</h2>
              <p className="text-sm text-red-500 font-bold mt-1">{failureMsg}</p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setState("selecting")}
                className="w-full h-12 bg-black text-white font-black uppercase tracking-widest text-[10px] hover:bg-primary transition-colors"
              >
                إعادة المحاولة
              </button>
              <button
                onClick={() => setLocation("/orders")}
                className="w-full h-12 border border-black/10 font-black uppercase tracking-widest text-[10px] hover:bg-gray-50 transition-colors"
              >
                متابعة بدون دفع
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-[#fcfcfc]" dir="rtl">
        <div className="container max-w-2xl py-12 px-4">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Lock className="h-5 w-5 text-green-600" />
              <span className="text-[10px] font-black uppercase tracking-widest text-green-600">اتصال آمن SSL</span>
            </div>
            <h1 className="font-display font-black text-3xl tracking-tighter">بوابة الدفع</h1>
            <p className="text-sm text-black/40 font-bold mt-1">
              طلب رقم: <span className="font-black text-black">#{orderRef}</span>
              {" · "}
              المبلغ: <span className="font-black text-primary">{amount.toLocaleString()} ر.س</span>
            </p>
          </div>

          {/* Payment Tabs */}
          <div className="grid grid-cols-2 border border-border mb-0 rounded-t-xl overflow-hidden">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`p-4 flex flex-col items-center gap-2 transition-all border-b-2 ${
                  tab === t.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <t.icon />
                <span className={`text-[10px] font-black ${tab === t.id ? "text-primary" : "text-muted-foreground"}`}>{t.label}</span>
                <span className="text-[8px] font-bold text-muted-foreground opacity-60">{t.sublabel}</span>
              </button>
            ))}
          </div>

          {/* Payment Form Area */}
          <div className="bg-card border border-border border-t-0 shadow-sm p-8 rounded-b-xl">
            {tab === "card" && (
              <CardPaymentForm
                onSubmit={handleCardSubmit}
                isProcessing={isCardProcessing}
              />
            )}

            {tab === "apple" && (
              <div className="space-y-6">
                <div className="text-center space-y-3 py-4">
                  <div className="flex justify-center">
                    <ApplePayLogo className="h-12 object-contain" />
                  </div>
                  <p className="text-sm text-black/40 font-bold">
                    ادفع بسرعة وأمان باستخدام Face ID أو Touch ID
                  </p>
                  <div className="inline-block bg-green-50 border border-green-200 rounded px-4 py-2 text-sm font-black text-green-700">
                    {amount.toLocaleString()} ر.س
                  </div>
                </div>
                <ApplePayButton
                  orderId={orderId || ""}
                  amount={amount}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentFailed}
                />
              </div>
            )}
          </div>

          {/* Test Cards Guide */}
          {tab === "card" && (
            <div className="mt-6 bg-amber-50 border border-amber-200 p-4 space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">دليل البطاقات التجريبية</p>
              <div className="space-y-1">
                {[
                  ["4988 4588 1234 5670", "مدى", "✅ نجاح"],
                  ["4111 1111 1111 1111", "Visa", "✅ نجاح + 3DS (OTP: 123456)"],
                  ["5200 8282 8282 8210", "Mastercard", "✅ نجاح + 3DS"],
                  ["4000 0000 0000 0002", "Visa", "❌ مرفوضة"],
                  ["4000 0000 0000 9995", "Visa", "❌ رصيد غير كافٍ"],
                ].map(([num, brand, result]) => (
                  <div key={num} className="flex items-center justify-between text-[9px] font-bold text-amber-800">
                    <span className="font-mono">{num}</span>
                    <span className="text-black/40">{brand}</span>
                    <span>{result}</span>
                  </div>
                ))}
              </div>
              <p className="text-[9px] text-amber-600 font-bold pt-1">CVV: أي 3 أرقام • تاريخ الانتهاء: أي تاريخ مستقبلي</p>
            </div>
          )}
        </div>
      </div>

      <ThreeDSModal
        open={show3DS}
        transactionId={transactionId}
        cardLast4={cardLast4}
        onVerify={handle3DSVerify}
        onCancel={() => { setShow3DS(false); setIsCardProcessing(false); }}
        isVerifying={is3DSVerifying}
      />
    </Layout>
  );
}
