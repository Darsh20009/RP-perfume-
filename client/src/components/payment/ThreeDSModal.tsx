import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Shield, Smartphone, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThreeDSModalProps {
  open: boolean;
  transactionId: string;
  cardLast4?: string;
  onVerify: (otp: string) => void;
  onCancel: () => void;
  isVerifying: boolean;
}

export function ThreeDSModal({ open, transactionId, cardLast4, onVerify, onCancel, isVerifying }: ThreeDSModalProps) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timeLeft, setTimeLeft] = useState(120);
  const [error, setError] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!open) { setOtp(["", "", "", "", "", ""]); setError(""); setTimeLeft(120); return; }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, [open]);

  const handleDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);
    setError("");

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (newOtp.every(d => d !== "") && digit) {
      onVerify(newOtp.join(""));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (text.length === 6) {
      const digits = text.split("");
      setOtp(digits);
      onVerify(text);
    }
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden border-0 shadow-2xl" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1A1F71] to-[#3B4DC8] p-8 text-white text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h2 className="font-black text-xl mb-1">التحقق بخطوتين</h2>
          <p className="text-blue-200 text-xs font-bold">3D Secure Authentication</p>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6 bg-white">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-black/60">
              <Smartphone className="h-4 w-4" />
              <span className="text-sm font-bold">تم إرسال رمز التحقق</span>
            </div>
            <p className="text-xs text-black/40 font-bold">
              إلى الجوال المسجل لبطاقة ••••{cardLast4 || "****"}
            </p>
            <p className="text-[10px] text-black/30 font-bold bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
              للاختبار: الرمز هو <span className="font-black text-yellow-700">123456</span>
            </p>
          </div>

          {/* OTP Input */}
          <div className="flex justify-center gap-2" dir="ltr">
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
                onPaste={handlePaste}
                disabled={isVerifying || timeLeft === 0}
                className={cn(
                  "w-12 h-14 text-center text-2xl font-black border-2 rounded-xl outline-none transition-all",
                  digit ? "border-primary bg-primary/5 text-primary" : "border-black/10 bg-gray-50",
                  isVerifying ? "opacity-50" : "focus:border-primary focus:bg-primary/5",
                  error ? "border-red-400 bg-red-50" : ""
                )}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-xs font-bold text-red-500">{error}</p>
          )}

          {/* Timer */}
          <div className="text-center">
            {timeLeft > 0 ? (
              <p className="text-xs font-bold text-black/40">
                ينتهي الرمز خلال{" "}
                <span className={cn("font-black", timeLeft < 30 ? "text-red-500" : "text-primary")}>
                  {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
                </span>
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-red-500">انتهت صلاحية الرمز</p>
                <button
                  onClick={() => setTimeLeft(120)}
                  className="flex items-center gap-1 text-xs font-black text-primary hover:underline mx-auto"
                >
                  <RefreshCw className="h-3 w-3" />
                  إعادة الإرسال
                </button>
              </div>
            )}
          </div>

          {/* Processing indicator */}
          {isVerifying && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="text-xs font-bold text-black/50">جاري التحقق...</span>
            </div>
          )}

          {/* Cancel */}
          <button
            onClick={onCancel}
            disabled={isVerifying}
            className="w-full text-xs font-black text-black/30 hover:text-black/60 transition-colors py-2"
          >
            إلغاء والعودة
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
