import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardPaymentFormProps {
  onSubmit: (data: {
    cardNumber: string;
    cardHolderName: string;
    expiryMonth: string;
    expiryYear: string;
    cvv: string;
  }) => void;
  isProcessing: boolean;
}

type CardBrand = "visa" | "mastercard" | "mada" | "amex" | "unknown";

const MADA_BINS = ["4002","4007","4009","4010","4014","4019","4024","4033","4040",
  "4988","9999","5078","5580","5589","5590","5591","5592","5593","5594","5095","5096","5097","5098","5099"];

function detectBrand(num: string): CardBrand {
  const clean = num.replace(/\D/g, "");
  if (MADA_BINS.some(b => clean.startsWith(b))) return "mada";
  if (/^4/.test(clean)) return "visa";
  if (/^5[1-5]/.test(clean) || /^2[2-7]/.test(clean)) return "mastercard";
  if (/^3[47]/.test(clean)) return "amex";
  return "unknown";
}

function formatCardNumber(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 16);
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 4);
  if (clean.length >= 2) return clean.slice(0, 2) + "/" + clean.slice(2);
  return clean;
}

const BrandLogo = ({ brand }: { brand: CardBrand }) => {
  if (brand === "visa") return (
    <div className="bg-[#1A1F71] text-white font-black italic text-xs px-2 py-0.5 rounded">VISA</div>
  );
  if (brand === "mastercard") return (
    <div className="flex">
      <div className="w-5 h-5 rounded-full bg-[#EB001B] opacity-90" />
      <div className="w-5 h-5 rounded-full bg-[#F79E1B] -ml-2 opacity-90" />
    </div>
  );
  if (brand === "mada") return (
    <div className="bg-[#0a5aa5] text-white font-black text-[10px] px-2 py-0.5 rounded">مدى</div>
  );
  if (brand === "amex") return (
    <div className="bg-[#2E77BC] text-white font-black text-[10px] px-2 py-0.5 rounded">AMEX</div>
  );
  return <CreditCard className="h-5 w-5 text-black/20" />;
};

export function CardPaymentForm({ onSubmit, isProcessing }: CardPaymentFormProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [showCvv, setShowCvv] = useState(false);
  const [brand, setBrand] = useState<CardBrand>("unknown");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFlipped, setIsFlipped] = useState(false);

  const expiryRef = useRef<HTMLInputElement>(null);
  const cvvRef = useRef<HTMLInputElement>(null);
  const holderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setBrand(detectBrand(cardNumber));
  }, [cardNumber]);

  const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    setCardNumber(formatted);
    setErrors(prev => ({ ...prev, cardNumber: "" }));
    if (formatted.replace(/\s/g, "").length === 16) {
      holderRef.current?.focus();
    }
  };

  const handleExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiry(e.target.value);
    setExpiry(formatted);
    setErrors(prev => ({ ...prev, expiry: "" }));
    if (formatted.length === 5) cvvRef.current?.focus();
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    const numClean = cardNumber.replace(/\s/g, "");

    if (numClean.length < 16) newErrors.cardNumber = "رقم البطاقة غير مكتمل";
    if (!cardHolder.trim()) newErrors.cardHolder = "اسم حامل البطاقة مطلوب";
    if (expiry.length < 5) newErrors.expiry = "تاريخ الانتهاء غير مكتمل";
    else {
      const [mm, yy] = expiry.split("/");
      const month = parseInt(mm, 10);
      const year = parseInt("20" + yy, 10);
      const now = new Date();
      if (month < 1 || month > 12) newErrors.expiry = "الشهر غير صحيح";
      else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
        newErrors.expiry = "البطاقة منتهية الصلاحية";
      }
    }
    if (cvv.length < 3) newErrors.cvv = "CVV غير مكتمل";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    const [month, year] = expiry.split("/");
    onSubmit({
      cardNumber: cardNumber.replace(/\s/g, ""),
      cardHolderName: cardHolder,
      expiryMonth: month,
      expiryYear: year,
      cvv,
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Virtual Card Preview */}
      <div
        className={cn(
          "relative w-full h-44 rounded-2xl p-6 transition-all duration-500 overflow-hidden select-none",
          isFlipped ? "" : "",
          brand === "visa" ? "bg-gradient-to-br from-[#1A1F71] to-[#3B4DC8]" :
          brand === "mastercard" ? "bg-gradient-to-br from-[#1a1a1a] to-[#444]" :
          brand === "mada" ? "bg-gradient-to-br from-[#0a5aa5] to-[#0d7ac7]" :
          brand === "amex" ? "bg-gradient-to-br from-[#2E77BC] to-[#5B9BD5]" :
          "bg-gradient-to-br from-gray-800 to-gray-600"
        )}
      >
        {/* Background shimmer */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-8 left-8 w-32 h-32 rounded-full bg-white blur-2xl" />
          <div className="absolute bottom-4 right-4 w-24 h-24 rounded-full bg-white blur-xl" />
        </div>

        <div className="relative z-10 h-full flex flex-col justify-between text-white">
          <div className="flex justify-between items-start">
            <div className="opacity-50 text-[8px] font-bold uppercase tracking-widest">
              {brand === "mada" ? "مدى" : brand !== "unknown" ? brand.toUpperCase() : ""}
            </div>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 opacity-40" />
              <BrandLogo brand={brand} />
            </div>
          </div>

          <div>
            <div className="font-mono text-xl tracking-[0.3em] mb-3">
              {(() => {
                const digits = cardNumber.replace(/\s/g, "");
                const groups = [0, 1, 2, 3].map(i =>
                  digits.slice(i * 4, i * 4 + 4).padEnd(4, "•")
                );
                return groups.join(" ");
              })()}
            </div>
            <div className="flex justify-between items-end">
              <div>
                <div className="text-[8px] opacity-50 uppercase tracking-widest mb-0.5">اسم الحامل</div>
                <div className="font-bold text-sm uppercase tracking-wider">
                  {cardHolder || "CARD HOLDER NAME"}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[8px] opacity-50 uppercase tracking-widest mb-0.5">صلاحية حتى</div>
                <div className="font-bold font-mono">{expiry || "MM/YY"}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Number */}
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">رقم البطاقة</Label>
        <div className="relative">
          <Input
            type="tel"
            inputMode="numeric"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={handleCardNumber}
            maxLength={19}
            className={cn(
              "h-14 text-lg font-mono tracking-widest border-2 bg-white pr-12",
              errors.cardNumber ? "border-red-400 focus-visible:ring-red-300" : "border-black/10 focus-visible:ring-primary/20"
            )}
            dir="ltr"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <BrandLogo brand={brand} />
          </div>
        </div>
        {errors.cardNumber && <p className="text-[10px] text-red-500 font-bold">{errors.cardNumber}</p>}
      </div>

      {/* Card Holder */}
      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">اسم حامل البطاقة</Label>
        <Input
          ref={holderRef}
          placeholder="JOHN DOE"
          value={cardHolder}
          onChange={(e) => { setCardHolder(e.target.value.toUpperCase()); setErrors(prev => ({ ...prev, cardHolder: "" })); }}
          className={cn(
            "h-14 font-bold tracking-widest border-2 bg-white",
            errors.cardHolder ? "border-red-400" : "border-black/10 focus-visible:ring-primary/20"
          )}
          dir="ltr"
        />
        {errors.cardHolder && <p className="text-[10px] text-red-500 font-bold">{errors.cardHolder}</p>}
      </div>

      {/* Expiry + CVV */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">تاريخ الانتهاء</Label>
          <Input
            ref={expiryRef}
            type="tel"
            inputMode="numeric"
            placeholder="MM/YY"
            value={expiry}
            onChange={handleExpiry}
            maxLength={5}
            className={cn(
              "h-14 font-mono text-center text-lg border-2 bg-white",
              errors.expiry ? "border-red-400" : "border-black/10 focus-visible:ring-primary/20"
            )}
            dir="ltr"
          />
          {errors.expiry && <p className="text-[10px] text-red-500 font-bold">{errors.expiry}</p>}
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest text-black/40">
            CVV
            <span className="text-black/20 mr-2 font-normal normal-case">({brand === "amex" ? "4 أرقام" : "3 أرقام"})</span>
          </Label>
          <div className="relative" onFocus={() => setIsFlipped(true)} onBlur={() => setIsFlipped(false)}>
            <Input
              ref={cvvRef}
              type={showCvv ? "text" : "password"}
              inputMode="numeric"
              placeholder="•••"
              value={cvv}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, brand === "amex" ? 4 : 3);
                setCvv(val);
                setErrors(prev => ({ ...prev, cvv: "" }));
              }}
              maxLength={brand === "amex" ? 4 : 3}
              className={cn(
                "h-14 font-mono text-center text-lg border-2 bg-white pr-10",
                errors.cvv ? "border-red-400" : "border-black/10 focus-visible:ring-primary/20"
              )}
              dir="ltr"
            />
            <button
              type="button"
              onClick={() => setShowCvv(!showCvv)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30 hover:text-black/60"
            >
              {showCvv ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.cvv && <p className="text-[10px] text-red-500 font-bold">{errors.cvv}</p>}
        </div>
      </div>

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isProcessing}
        className="w-full h-16 bg-black text-white font-black uppercase tracking-[0.3em] text-[11px] transition-all hover:bg-primary active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-none flex items-center justify-center gap-3"
      >
        {isProcessing ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>جاري المعالجة...</span>
          </>
        ) : (
          <>
            <Lock className="h-4 w-4" />
            <span>ادفع الآن</span>
          </>
        )}
      </button>

      {/* Security badges */}
      <div className="flex items-center justify-center gap-4 pt-2">
        {["SSL", "3DS", "PCI"].map(badge => (
          <div key={badge} className="flex items-center gap-1 text-[9px] font-black text-black/30 border border-black/10 px-2 py-1">
            <Lock className="h-2.5 w-2.5" />
            {badge}
          </div>
        ))}
      </div>
    </div>
  );
}
