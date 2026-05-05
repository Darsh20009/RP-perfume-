import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/hooks/use-language";
import { MapPin, Phone, Clock, Mail, Building, Navigation, Store } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/Layout";

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
  pickupHours?: string;
  image?: string;
  latitude?: number | null;
  longitude?: number | null;
  isPickupEnabled?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  mapUrl?: string;
}

const googleMapsUrl = (b: Branch) =>
  b.latitude && b.longitude
    ? `https://www.google.com/maps/search/?api=1&query=${b.latitude},${b.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([b.name, b.address || b.location, b.city].filter(Boolean).join(", "))}`;

export default function Branches() {
  const { language, isAr: isRTL } = useLanguage();
  const { data: branches = [], isLoading } = useQuery<Branch[]>({ queryKey: ["/api/branches"] });

  const active = (branches || [])
    .filter(b => b.isActive !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const title = language === "ar" ? "فروعنا" : "Our Branches";
  const subtitle = language === "ar"
    ? "زورونا في أحد فروعنا للاستمتاع بتجربة العود الفاخرة"
    : "Visit one of our boutiques and experience our signature oud collections";

  return (
    <Layout>
      <div className="min-h-screen bg-white" dir={isRTL ? "rtl" : "ltr"} data-testid="page-branches">

        {/* Hero */}
        <div className="relative bg-gradient-to-br from-[#1a1a3e] via-[#2B2B60] to-[#1a1a3e] text-white overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: "radial-gradient(ellipse at 20% 50%, #DFB369 0%, transparent 60%), radial-gradient(ellipse at 80% 50%, #DFB369 0%, transparent 60%)",
            }}
          />
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23DFB369' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
          <div className="container relative px-4 py-16 sm:py-20 md:py-28 text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-5 bg-[#DFB369]/10 border border-[#DFB369]/30 rounded-2xl flex items-center justify-center">
              <Building className="h-7 w-7 sm:h-8 sm:h-8 text-[#DFB369]" />
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight mb-3">{title}</h1>
            <div className="w-16 h-0.5 bg-[#DFB369] mx-auto mb-4 sm:mb-5" />
            <p className="max-w-xl mx-auto text-sm sm:text-base text-white/70 font-medium leading-relaxed">{subtitle}</p>
          </div>
        </div>

        {/* Content */}
        <div className="container px-4 py-10 sm:py-14 md:py-18">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-9 w-9 animate-spin text-[#DFB369]" />
              <p className="text-sm font-bold text-gray-400">{language === "ar" ? "جاري تحميل الفروع..." : "Loading branches..."}</p>
            </div>
          )}

          {!isLoading && active.length === 0 && (
            <div className="max-w-sm mx-auto text-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-2xl flex items-center justify-center">
                <Building className="h-8 w-8 text-gray-300" />
              </div>
              <p className="font-black text-gray-700 text-lg mb-1">{language === "ar" ? "لا توجد فروع" : "No branches yet"}</p>
              <p className="text-sm text-gray-400 font-medium">{language === "ar" ? "لا توجد فروع متاحة حالياً" : "No branches available at the moment"}</p>
            </div>
          )}

          {active.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-6">
              {active.map(b => {
                const displayName = language === "en" && b.nameEn ? b.nameEn : b.name;
                const displayAddr = language === "en" && b.addressEn ? b.addressEn : (b.address || b.location || "");
                const mapsUrl = b.mapUrl || googleMapsUrl(b);

                return (
                  <div
                    key={b.id}
                    data-testid={`card-branch-${b.id}`}
                    className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col"
                  >
                    {/* Image / placeholder */}
                    <div className="relative h-44 sm:h-48 bg-gradient-to-br from-[#2B2B60] to-[#1a1a3e] overflow-hidden shrink-0">
                      {b.image ? (
                        <img src={b.image} alt={displayName} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <Store className="h-14 w-14 text-[#DFB369]/40 mx-auto mb-2" />
                            <p className="text-[#DFB369]/40 font-black text-xs uppercase tracking-widest">RF PERFUME</p>
                          </div>
                        </div>
                      )}
                      {/* Pickup badge */}
                      {b.isPickupEnabled !== false && (
                        <div className="absolute top-3 right-3">
                          <span className="bg-[#DFB369] text-[#1a1a3e] text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg">
                            {language === "ar" ? "استلام متاح" : "Pickup Available"}
                          </span>
                        </div>
                      )}
                      {b.city && (
                        <div className="absolute bottom-3 left-3">
                          <span className="bg-black/40 backdrop-blur-sm text-white text-[10px] font-bold px-2.5 py-1 rounded-full">
                            {b.city}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
                      <div>
                        <h2
                          className="font-black text-lg sm:text-xl text-gray-900 tracking-tight"
                          data-testid={`text-branch-name-${b.id}`}
                        >
                          {displayName}
                        </h2>
                      </div>

                      <div className="space-y-2 flex-1">
                        {displayAddr && (
                          <div className="flex items-start gap-2.5 text-sm text-gray-600">
                            <MapPin className="h-4 w-4 text-[#DFB369] shrink-0 mt-0.5" />
                            <span className="font-medium leading-snug">{displayAddr}</span>
                          </div>
                        )}
                        {b.phone && (
                          <a
                            href={`tel:${b.phone}`}
                            className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-[#DFB369] transition-colors"
                          >
                            <Phone className="h-4 w-4 text-[#DFB369] shrink-0" />
                            <span className="font-medium" dir="ltr">{b.phone}</span>
                          </a>
                        )}
                        {b.email && (
                          <a
                            href={`mailto:${b.email}`}
                            className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-[#DFB369] transition-colors"
                          >
                            <Mail className="h-4 w-4 text-[#DFB369] shrink-0" />
                            <span className="font-medium truncate">{b.email}</span>
                          </a>
                        )}
                        {(b.pickupHours || b.hours) && (
                          <div className="flex items-start gap-2.5 text-sm text-gray-600">
                            <Clock className="h-4 w-4 text-[#DFB369] shrink-0 mt-0.5" />
                            <span className="font-medium leading-snug">{b.pickupHours || b.hours}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="pt-2 mt-auto">
                        <a
                          data-testid={`link-maps-${b.id}`}
                          href={mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center justify-center gap-2 w-full py-3 bg-[#2B2B60] hover:bg-[#1a1a3e] text-white text-sm font-black rounded-xl transition-colors active:scale-95"
                        >
                          <Navigation className="h-4 w-4" />
                          {language === "ar" ? "الاتجاهات على الخريطة" : "Get Directions"}
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
