import tabbyImg from "@assets/image_1774356250671.png";
import tamaraImg from "@assets/image_1774356262659.png";
import stcPayImg from "@assets/image_1774356279079.png";
import cardBrandsImg from "@assets/image_1774356309971.png";
import alRajhiImg from "@assets/image_1774356329374.png";

export function CardBrandsLogo({ className = "h-8" }: { className?: string }) {
  return <img src={cardBrandsImg} alt="Visa · Mastercard · مدى" className={`${className} object-contain`} />;
}

export function ApplePayLogo({ className = "h-7" }: { className?: string }) {
  return (
    <svg className={`${className} object-contain`} viewBox="0 0 165 105" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="165" height="105" rx="8" fill="black"/>
      <path d="M51.8 35.2c1.8-2.2 3-5.2 2.7-8.2-2.6.1-5.8 1.7-7.6 3.9-1.7 1.9-3.1 5-2.7 7.9 2.9.2 5.8-1.4 7.6-3.6z" fill="white"/>
      <path d="M54.4 39.3c-4.2-.2-7.8 2.4-9.8 2.4-2 0-5.1-2.3-8.4-2.2-4.3.1-8.3 2.5-10.5 6.4-4.5 7.7-1.2 19.2 3.2 25.5 2.1 3.1 4.7 6.5 8 6.4 3.2-.1 4.4-2.1 8.3-2.1 3.8 0 4.9 2.1 8.3 2 3.5-.1 5.7-3.1 7.8-6.2 2.4-3.5 3.4-6.9 3.5-7.1-.1 0-6.7-2.6-6.7-10.2-.1-6.4 5.2-9.4 5.5-9.6-3-4.4-7.6-4.9-9.2-5.3z" fill="white"/>
      <text x="83" y="58" fill="white" fontSize="16" fontWeight="600" fontFamily="-apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif" textAnchor="start" dominantBaseline="middle">Pay</text>
    </svg>
  );
}

export function STCPayLogo({ className = "h-7" }: { className?: string }) {
  return <img src={stcPayImg} alt="STC Pay" className={`${className} object-contain`} />;
}

export function TabbyLogo({ className = "h-7" }: { className?: string }) {
  return <img src={tabbyImg} alt="Tabby" className={`${className} object-contain`} />;
}

export function TamaraLogo({ className = "h-7" }: { className?: string }) {
  return <img src={tamaraImg} alt="Tamara" className={`${className} object-contain`} />;
}

export function AlRajhiLogo({ className = "h-10" }: { className?: string }) {
  return <img src={alRajhiImg} alt="مصرف الراجحي" className={`${className} object-contain`} />;
}

export function BankLogo({ bankName, bankLogoUrl, className = "h-10" }: { bankName?: string; bankLogoUrl?: string; className?: string }) {
  if (bankLogoUrl) {
    return <img src={bankLogoUrl} alt={bankName || "البنك"} className={`${className} object-contain`} />;
  }
  const name = (bankName || "").toLowerCase();
  if (name.includes("راجحي") || name.includes("rajhi")) {
    return <AlRajhiLogo className={className} />;
  }
  return null;
}

export function AmexLogo({ className = "h-7" }: { className?: string }) {
  return (
    <div className={`${className} aspect-[3/1] bg-[#016fd0] rounded-md flex items-center justify-center px-2 shadow-sm`}>
      <svg viewBox="0 0 120 32" className="h-full w-auto" fill="none">
        <text x="60" y="22" textAnchor="middle" fill="white" fontSize="10" fontWeight="900" fontFamily="'Arial Black', 'Arial', sans-serif" letterSpacing="1.5">AMERICAN EXPRESS</text>
      </svg>
    </div>
  );
}

export function PaymentMethodCard({
  logo, name, bg, textColor = "white", className = "",
}: { logo: React.ReactNode; name?: string; bg: string; textColor?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl px-3 py-2 shadow-sm border border-white/10 min-w-[64px] h-10 ${className}`} style={{ background: bg }} title={name}>
      {logo}
    </div>
  );
}
