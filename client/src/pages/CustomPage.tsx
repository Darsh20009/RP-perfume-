import { Layout } from "@/components/Layout";
import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Loader2, FileX } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { useEffect } from "react";

type Page = {
  id: string;
  slug: string;
  titleAr: string; titleEn: string;
  excerptAr: string; excerptEn: string;
  heroImage: string; heroOverlay: string;
  contentAr: string; contentEn: string;
  seoTitle: string; seoDescription: string;
};

export default function CustomPage() {
  const [, params] = useRoute("/pages/:slug");
  const slug = params?.slug;
  const { language } = useLanguage();
  const isAr = language === "ar";

  const { data: page, isLoading, error } = useQuery<Page>({
    queryKey: ["/api/pages", slug],
    queryFn: async () => {
      const res = await fetch(`/api/pages/${slug}`);
      if (!res.ok) throw new Error("not-found");
      return res.json();
    },
    enabled: !!slug,
    retry: false,
  });

  useEffect(() => {
    if (page) {
      const t = page.seoTitle || (isAr ? page.titleAr : page.titleEn) || "عطور آر اف";
      document.title = `${t} | عطور آر اف`;
      const desc = page.seoDescription || (isAr ? page.excerptAr : page.excerptEn);
      if (desc) {
        let m = document.querySelector('meta[name="description"]');
        if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
        m.setAttribute("content", desc);
      }
    }
  }, [page, isAr]);

  if (isLoading) {
    return <Layout><div className="flex items-center justify-center py-32"><Loader2 className="w-10 h-10 animate-spin text-[#DFB369]" /></div></Layout>;
  }

  if (error || !page) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-32 px-4 text-center" dir={isAr ? "rtl" : "ltr"}>
          <FileX className="w-16 h-16 text-[#DFB369]/40 mb-4" />
          <h1 className="text-2xl font-black text-[#2B2B60] mb-2">{isAr ? "الصفحة غير موجودة" : "Page Not Found"}</h1>
          <p className="text-sm text-slate-500">{isAr ? "ربما تم نقلها أو حذفها." : "It may have been moved or deleted."}</p>
        </div>
      </Layout>
    );
  }

  const title = isAr ? (page.titleAr || page.titleEn) : (page.titleEn || page.titleAr);
  const excerpt = isAr ? (page.excerptAr || page.excerptEn) : (page.excerptEn || page.excerptAr);
  const content = isAr ? (page.contentAr || page.contentEn) : (page.contentEn || page.contentAr);

  return (
    <Layout>
      <div dir={isAr ? "rtl" : "ltr"} data-testid={`page-${page.slug}`}>
        {/* Hero */}
        {page.heroImage ? (
          <section className="relative h-[55vh] min-h-[360px] overflow-hidden">
            <img src={page.heroImage} alt="" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ backgroundColor: page.heroOverlay || "rgba(26,39,68,0.55)" }} />
            <div className="relative h-full flex flex-col items-center justify-center text-center text-white px-6">
              <span className="inline-block text-[10px] font-bold uppercase tracking-[0.4em] text-[#DFB369] mb-3">{isAr ? "عطور آر اف" : "Rfeef Al Oud"}</span>
              <h1 className="text-4xl md:text-6xl font-black tracking-tight drop-shadow-lg">{title}</h1>
              {excerpt && <p className="mt-4 max-w-2xl text-base md:text-lg text-white/85 leading-relaxed">{excerpt}</p>}
              <div className="mt-6 h-px w-24 bg-gradient-to-r from-transparent via-[#DFB369] to-transparent" />
            </div>
          </section>
        ) : (
          <section className="bg-gradient-to-br from-[#FFFFFF] via-white to-[#FFFFFF] py-20 text-center">
            <div className="container px-4">
              <h1 className="text-4xl md:text-5xl font-black text-[#2B2B60]">{title}</h1>
              {excerpt && <p className="mt-4 max-w-2xl mx-auto text-base text-slate-600 leading-relaxed">{excerpt}</p>}
              <div className="mt-6 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-[#DFB369] to-transparent" />
            </div>
          </section>
        )}

        {/* Content */}
        <section className="py-16 md:py-20 bg-white">
          <div className="container px-4 max-w-3xl mx-auto">
            <article
              className="prose prose-lg max-w-none text-slate-700 leading-loose [&_h2]:text-[#2B2B60] [&_h2]:font-black [&_h2]:mt-8 [&_h2]:mb-4 [&_h3]:text-[#2B2B60] [&_h3]:font-bold [&_a]:text-[#DFB369] [&_a]:font-bold hover:[&_a]:underline [&_p]:mb-4 [&_ul]:mb-4 [&_li]:mb-1 [&_img]:rounded-xl [&_img]:my-6"
              dangerouslySetInnerHTML={{ __html: content || `<p class="text-slate-400 italic">${isAr ? "لا يوجد محتوى بعد." : "No content yet."}</p>` }}
            />
          </div>
        </section>
      </div>
    </Layout>
  );
}
