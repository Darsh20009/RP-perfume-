import React, { useEffect, useRef, useId } from "react";
import { Sparkles } from "lucide-react";

declare global {
  interface Window {
    tamaraWidgetConfig?: Record<string, any>;
    loadTamaraProductWidget?: (opts: Record<string, any>) => void;
    TabbyPromo?: any;
  }
  namespace JSX {
    interface IntrinsicElements {
      "tamara-widget": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
        type?: string;
        "inline-type"?: string;
        uuid?: string;
        amount?: string;
      }, HTMLElement>;
    }
  }
}

const TAMARA_PUBLIC_KEY = "e56d8ae9-bb47-408b-8451-959ba5ef25c7";

function loadScript(src: string, id: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.getElementById(id)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src;
    s.id = id;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.head.appendChild(s);
  });
}

function TamaraWidget({ price, language }: { price: number; language: string }) {
  const lang = language === "ar" ? "ar" : "en";
  const uniqueId = useId().replace(/:/g, "");

  useEffect(() => {
    window.tamaraWidgetConfig = {
      lang,
      country: "SA",
      publicKey: TAMARA_PUBLIC_KEY,
    };

    loadScript("https://cdn.tamara.co/widget-v2/tamara-widget.js", "tamara-widget-script").then(() => {
      setTimeout(() => {
        try {
          window.loadTamaraProductWidget?.({
            price,
            sale_price: null,
            lang,
            country: "SA",
          });
        } catch {}
      }, 300);
    });
  }, [price, lang]);

  return (
    <div className="rounded-2xl border border-[#1d1d1d]/10 overflow-hidden p-4 bg-white min-h-[60px] flex items-center" dir={lang === "ar" ? "rtl" : "ltr"}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {React.createElement("tamara-widget", {
        className: "tamara-product-widget w-full",
        type: "tamara-summary",
        "inline-type": "2",
        uuid: uniqueId,
        amount: String(price),
      } as any)}
    </div>
  );
}

function TabbyWidget({ price, language }: { price: number; language: string }) {
  const lang = language === "ar" ? "ar" : "en";
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<any>(null);
  const selectorId = useId().replace(/:/g, "tabby-");

  useEffect(() => {
    loadScript("https://checkout.tabby.ai/tabby-promo.js", "tabby-promo-script").then(() => {
      setTimeout(() => {
        try {
          if (instanceRef.current) {
            try { instanceRef.current.destroy?.(); } catch {}
          }
          if (window.TabbyPromo && containerRef.current) {
            containerRef.current.id = selectorId;
            instanceRef.current = new window.TabbyPromo({
              selector: `#${selectorId}`,
              currency: "SAR",
              lang,
              price,
              installmentsCount: 4,
              source: "product",
            });
          }
        } catch {}
      }, 300);
    });
    return () => {
      try { instanceRef.current?.destroy?.(); } catch {}
    };
  }, [price, lang, selectorId]);

  return (
    <div className="rounded-2xl border border-[#3eb489]/15 overflow-hidden p-4 bg-white min-h-[60px]" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div ref={containerRef} id={selectorId} />
    </div>
  );
}

export function InstallmentSection({ price, language }: { price: number | string; language: string }) {
  const isRtl = language === "ar";
  const priceNum = parseFloat(String(price)) || 0;

  if (priceNum <= 0) return null;

  return (
    <div className="mb-10" data-testid="section-installment-plans">
      <div className={`flex items-center gap-2 mb-5 ${isRtl ? "flex-row-reverse" : ""}`}>
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">
          {isRtl ? "اشتري الآن، ادفع لاحقاً" : "Buy Now, Pay Later"}
        </span>
      </div>

      <div className="space-y-3">
        <TabbyWidget price={priceNum} language={language} />
        <TamaraWidget price={priceNum} language={language} />
      </div>
    </div>
  );
}
