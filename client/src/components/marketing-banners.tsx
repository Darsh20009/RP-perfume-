import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function MarketingBanners() {
  const { data: marketing } = useQuery<any[]>({ 
    queryKey: ["/api/marketing/active"],
    queryFn: async () => {
      const res = await fetch("/api/marketing/active", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const [showPopup, setShowPopup] = useState(false);
  const [activePopup, setActivePopup] = useState<any>(null);

  useEffect(() => {
    if (!marketing) return;
    
    const popup = marketing.find(m => m.type === 'popup' && m.isActive);
    if (popup && !showPopup) {
      const timer = setTimeout(() => {
        setActivePopup(popup);
        setShowPopup(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [marketing, showPopup]);

  const banners = marketing?.filter(m => m.type === 'banner' && m.isActive) || [];

  if (!marketing) return null;

  return (
    <>
      {/* Banners Section */}
      {banners.length > 0 && (
        <div className="relative w-full text-white py-2.5 overflow-hidden" style={{ background: "linear-gradient(90deg, #0F0F0F 0%, #2B2B60 25%, #850935 50%, #2B2B60 75%, #0F0F0F 100%)" }}>
          {/* gold accent border top + bottom */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#DFB369] to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#DFB369] to-transparent" />
          <div className="flex animate-marquee whitespace-nowrap gap-8 items-center" dir="ltr">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-8 items-center">
                {banners.map((banner: any) => (
                  <div key={banner.id} className="flex items-center gap-4">
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#DFB369]">✦</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.3em]">{banner.title}</span>
                    <div className="w-1 h-1 bg-[#DFB369]/60 rounded-full" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popup Dialog */}
      <Dialog open={showPopup} onOpenChange={setShowPopup}>
        <DialogContent className="max-w-lg p-0 overflow-hidden rounded-none border-none bg-transparent shadow-none">
          {activePopup && (
            <div className="relative group bg-white shadow-2xl">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 left-4 z-50 text-black hover:bg-black/5"
                onClick={() => setShowPopup(false)}
              >
                <X className="h-5 w-5" />
              </Button>
              
              <div className="aspect-square relative overflow-hidden">
                {activePopup.mediaType === 'video' && activePopup.video ? (
                  <video
                    src={activePopup.video}
                    poster={activePopup.image}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                    data-testid="video-popup"
                  />
                ) : (
                  <img 
                    src={activePopup.image} 
                    alt={activePopup.title} 
                    className="w-full h-full object-cover transition-transform duration-1000 "
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-8 text-white text-right">
                  <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">{activePopup.title}</h2>
                  {activePopup.link && (
                    <a href={activePopup.link} className="inline-block mt-4">
                      <Button className="rounded-none bg-white text-black font-bold uppercase tracking-widest text-xs h-12 px-8 hover:bg-black hover:text-white transition-all">
                        تسوق الآن
                      </Button>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
