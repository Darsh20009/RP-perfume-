import { useEffect } from "react";

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  productSchema?: {
    name: string;
    nameEn?: string;
    description?: string;
    image?: string;
    price?: string | number;
    sku?: string;
    brand?: string;
    availability?: "InStock" | "OutOfStock" | "PreOrder";
  };
}

const BASE_URL = "https://rfperfume.sa";
const BRAND = "عطور آر اف | RF Perfume";
const DEFAULT_IMG = `${BASE_URL}/og-cover.png`;

function setMeta(name: string, content: string, attr: "name" | "property" = "name") {
  let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement;
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(id: string, data: object) {
  let el = document.getElementById(id) as HTMLScriptElement;
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

export function SEO({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType = "website",
  productSchema,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${BRAND}` : `${BRAND} — عطور فاخرة سعودية`;
  const fullDescription = description ||
    "عطور آر اف — متجر العطور الفاخرة في المملكة العربية السعودية. اكتشف أرقى العطور الشرقية والغربية، العود الكمبودي، المسك الأبيض، والبخور الفاخر.";
  const img = ogImage || DEFAULT_IMG;
  const url = canonical ? `${BASE_URL}${canonical}` : BASE_URL;

  useEffect(() => {
    document.title = fullTitle;

    setMeta("description", fullDescription);
    if (keywords) setMeta("keywords", keywords);
    setLink("canonical", url);

    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", fullDescription, "property");
    setMeta("og:image", img, "property");
    setMeta("og:url", url, "property");
    setMeta("og:type", ogType, "property");

    setMeta("twitter:title", fullTitle, "name");
    setMeta("twitter:description", fullDescription, "name");
    setMeta("twitter:image", img, "name");

    if (productSchema) {
      setJsonLd("ld-product", {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": productSchema.name,
        "alternateName": productSchema.nameEn,
        "description": productSchema.description,
        "image": productSchema.image || img,
        "brand": {
          "@type": "Brand",
          "name": productSchema.brand || BRAND,
        },
        "sku": productSchema.sku,
        "offers": {
          "@type": "Offer",
          "url": url,
          "priceCurrency": "SAR",
          "price": productSchema.price?.toString() || "0",
          "availability": `https://schema.org/${productSchema.availability || "InStock"}`,
          "seller": {
            "@type": "Organization",
            "name": BRAND,
          },
        },
      });
    }

    return () => {
      document.title = `${BRAND} — عطور فاخرة سعودية`;
    };
  }, [fullTitle, fullDescription, keywords, url, img, ogType, productSchema]);

  return null;
}
