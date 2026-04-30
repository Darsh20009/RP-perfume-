import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymobResult() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [orderId, setOrderId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const oid = params.get("orderId") || params.get("merchant_order_id") || "";
    setOrderId(oid);

    // ✅ Successful card payment: redirect immediately to the unified order-success page.
    if (success === "true" && oid) {
      setLocation(`/orders/${oid}/success?paid=paymob`);
      return;
    }

    setTimeout(() => {
      setStatus(success === "true" ? "success" : "failed");
    }, 1500);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-[#f6f6f5] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center space-y-6">
        {status === "loading" && (
          <>
            <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-[#DFB369] animate-spin" />
            </div>
            <h2 className="text-xl font-black text-gray-800">جاري التحقق من الدفع...</h2>
            <p className="text-sm text-gray-800 font-bold">يرجى الانتظار</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-black text-green-800">تمت عملية الدفع بنجاح!</h2>
            <p className="text-sm text-gray-800 font-bold">
              شكراً لتسوقك من عطور آر اف. سيتم تجهيز طلبك وشحنه قريباً.
            </p>
            {orderId && (
              <p className="text-xs text-gray-700 font-bold">
                رقم الطلب: <span className="font-black text-gray-600">{orderId.slice(-8).toUpperCase()}</span>
              </p>
            )}
            <div className="space-y-3 pt-4">
              <Button
                onClick={() => setLocation("/orders")}
                className="w-full h-12 bg-black text-white font-black uppercase tracking-widest text-[11px] rounded-xl hover:bg-[#DFB369]"
              >
                متابعة طلباتي
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="w-full h-12 font-black uppercase tracking-widest text-[11px] rounded-xl"
              >
                العودة للمتجر
              </Button>
            </div>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="h-10 w-10 text-red-600" />
            </div>
            <h2 className="text-xl font-black text-red-800">فشلت عملية الدفع</h2>
            <p className="text-sm text-gray-800 font-bold">
              لم تتم عملية الدفع. يرجى المحاولة مرة أخرى أو اختيار طريقة دفع مختلفة.
            </p>
            <div className="space-y-3 pt-4">
              <Button
                onClick={() => setLocation("/checkout")}
                className="w-full h-12 bg-black text-white font-black uppercase tracking-widest text-[11px] rounded-xl hover:bg-[#DFB369]"
              >
                إعادة المحاولة
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/")}
                className="w-full h-12 font-black uppercase tracking-widest text-[11px] rounded-xl"
              >
                العودة للمتجر
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
