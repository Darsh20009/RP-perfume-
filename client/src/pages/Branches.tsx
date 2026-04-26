import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { MapPin, Phone, Clock, Mail, Building, Navigation } from "lucide-react";
import { Loader2 } from "lucide-react";
import { AppleMapEmbed } from "@/components/AppleMapEmbed";

interface Branch {
  id: string;
  _id?: string;
  name: string;
  nameEn?: string;
  address?: string;
  addressEn?: string;
  location?: string;
  city?: string;
  phone?: string;
  email?: string;
  hours?: string;
  image?: string;
  latitude?: number | null;
  longitude?: number | null;
  isPickupEnabled?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

const appleMapsUrl = (b: Branch) => b.latitude && b.longitude
  ? `https://maps.apple.com/?ll=${b.latitude},${b.longitude}&q=${encodeURIComponent(b.name)}`
  : `https://maps.apple.com/?q=${encodeURIComponent([b.name, b.address || b.location, b.city].filter(Boolean).join(", "))}`;

const googleMapsUrl = (b: Branch) => b.latitude && b.longitude
  ? `https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.name, b.address || b.location, b.city].filter(Boolean).join(", "))}`;


export default function Branches() {
  const { language, isAr: isRTL } = useLanguage();
  const { data: branches = [], isLoading } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });

  const active = (branches || []).filter(b => b.isActive !== false).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const title = language === "ar" ? "فروعنا" : "Our Branches";
  const subtitle = language === "ar"
    ? "زورونا في أحد فروعنا للاستمتاع بتجربة العود الفاخرة عن قرب"
    : "Visit one of our boutiques and experience our signature oud collections in person";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFFFFF] to-white" dir={isRTL ? "rtl" : "ltr"} data-testid="page-branches">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-[#2B2B60] via-[#27325a] to-[#2B2B60] text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 30%, #DFB369 0%, transparent 50%), radial-gradient(circle at 80% 70%, #DFB369 0%, transparent 50%)" }} />
        <div className="container relative px-4 py-20 md:py-28 text-center">
          <Building className="h-12 w-12 mx-auto mb-6 text-[#DFB369]" />
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4">{title}</h1>
          <div className="w-24 h-px bg-[#DFB369] mx-auto mb-6" />
          <p className="max-w-2xl mx-auto text-sm md:text-base text-white/80 leading-relaxed">{subtitle}</p>
        </div>
      </div>

      <div className="container px-4 py-12 md:py-16">
        {isLoading && (
          <div className="flex items-center justify-center py-24"><Loader2 className="h-10 w-10 animate-spin text-[#DFB369]" /></div>
        )}

        {!isLoading && active.length === 0 && (
          <div className="max-w-md mx-auto text-center py-20">
            <Building className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-bold">{language === "ar" ? "لا توجد فروع متاحة حالياً" : "No branches available yet"}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {active.map(b => {
            const displayName = language === "en" && b.nameEn ? b.nameEn : b.name;
            const displayAddr = language === "en" && b.addressEn ? b.addressEn : (b.address || b.location || "");
            return (
              <div key={b.id} data-testid={`card-branch-${b.id}`} className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-500 border border-gray-100">
                {/* Map preview */}
                <div className="relative h-56 bg-gradient-to-br from-[#F5F2ED] to-[#FFFFFF] overflow-hidden">
                  {b.latitude && b.longitude ? (
                    <AppleMapEmbed lat={Number(b.latitude)} lng={Number(b.longitude)} label={displayName} height={224} />
                  ) : b.image ? (
                    <img src={b.image} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Building className="h-16 w-16 text-[#DFB369]/30" /></div>
                  )}
                </div>

                <div className="p-6 md:p-8 space-y-5">
                  <div>
                    <h2 className="text-2xl md:text-3xl font-black text-[#2B2B60] tracking-tight" data-testid={`text-branch-name-${b.id}`}>{displayName}</h2>
                    {b.city && <p className="text-xs uppercase tracking-widest text-[#DFB369] font-black mt-1">{b.city}</p>}
                  </div>

                  <div className="space-y-3 text-sm">
                    {displayAddr && (
                      <div className="flex items-start gap-3 text-gray-700">
                        <span className="bg-[#DFB369]/10 p-2 rounded-lg text-[#DFB369] shrink-0"><MapPin className="h-4 w-4" /></span>
                        <span className="font-medium leading-relaxed pt-1.5">{displayAddr}</span>
                      </div>
                    )}
                    {b.phone && (
                      <a href={`tel:${b.phone}`} className="flex items-center gap-3 text-gray-700 hover:text-[#DFB369] transition-colors group/item">
                        <span className="bg-[#DFB369]/10 p-2 rounded-lg text-[#DFB369] group-hover/item:bg-[#DFB369] group-hover/item:text-white transition-colors shrink-0"><Phone className="h-4 w-4" /></span>
                        <span className="font-bold" dir="ltr">{b.phone}</span>
                      </a>
                    )}
                    {b.email && (
                      <a href={`mailto:${b.email}`} className="flex items-center gap-3 text-gray-700 hover:text-[#DFB369] transition-colors group/item">
                        <span className="bg-[#DFB369]/10 p-2 rounded-lg text-[#DFB369] group-hover/item:bg-[#DFB369] group-hover/item:text-white transition-colors shrink-0"><Mail className="h-4 w-4" /></span>
                        <span className="font-bold" dir="ltr">{b.email}</span>
                      </a>
                    )}
                    {b.hours && (
                      <div className="flex items-start gap-3 text-gray-700">
                        <span className="bg-[#DFB369]/10 p-2 rounded-lg text-[#DFB369] shrink-0"><Clock className="h-4 w-4" /></span>
                        <span className="font-medium pt-1.5">{b.hours}</span>
                      </div>
                    )}
                  </div>

                  {b.isPickupEnabled !== false && (
                    <div className="bg-[#DFB369]/5 border border-[#DFB369]/20 px-4 py-2 rounded-lg">
                      <p className="text-xs font-black text-[#DFB369] uppercase tracking-wider">
                        {language === "ar" ? "✓ يدعم الاستلام من الفرع" : "✓ In-store pickup available"}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <a
                      data-testid={`link-apple-maps-${b.id}`}
                      href={appleMapsUrl(b)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-[#2B2B60] text-white text-xs font-black uppercase tracking-widest rounded-lg hover:bg-[#27325a] transition-colors"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      {language === "ar" ? "خرائط أبل" : "Apple Maps"}
                    </a>
                    <a
                      data-testid={`link-google-maps-${b.id}`}
                      href={googleMapsUrl(b)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-[#DFB369] text-[#DFB369] text-xs font-black uppercase tracking-widest rounded-lg hover:bg-[#DFB369] hover:text-white transition-colors"
                    >
                      <Navigation className="h-3.5 w-3.5" />
                      {language === "ar" ? "خرائط جوجل" : "Google Maps"}
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
