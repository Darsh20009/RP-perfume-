import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { initPixels, trackPixelEvent, type PixelConfig } from "@/lib/pixels";

export function PixelTracker() {
  const [location] = useLocation();

  const { data: config } = useQuery<PixelConfig>({
    queryKey: ["/api/pixels"],
    staleTime: 15 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    if (!config) return;
    initPixels(config);
  }, [config]);

  useEffect(() => {
    if (!config) return;
    if (
      config.facebookPixelId ||
      config.tiktokPixelId ||
      config.snapchatPixelId ||
      config.twitterPixelId ||
      config.gtmId
    ) {
      trackPixelEvent("PageView");
    }
  }, [location, config]);

  return null;
}
