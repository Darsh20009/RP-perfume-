import { useEffect, useRef, useState } from "react";
import { useMapKit } from "@/hooks/use-mapkit";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, Navigation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface LocationMapProps {
  onLocationSelect: (coords: { lat: number; lng: number }, address: string) => void;
  initialLat?: number;
  initialLng?: number;
}

export function LocationMap({
  onLocationSelect,
  initialLat = 24.7136,
  initialLng = 46.6753,
}: LocationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const annotationRef = useRef<any>(null);
  const { ready, error } = useMapKit();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });
  const [address, setAddress] = useState("");

  // Reverse-geocode helper using MapKit JS lookup
  const reverseGeocode = (lat: number, lng: number) => {
    try {
      const mk = window.mapkit;
      if (!mk?.Geocoder) return;
      const geocoder = new mk.Geocoder({ language: "ar-SA" });
      const coord = new mk.Coordinate(lat, lng);
      geocoder.reverseLookup(coord, (err: any, data: any) => {
        if (err || !data?.results?.[0]) return;
        const r = data.results[0];
        const parts = [r.subLocality || r.locality, r.administrativeArea, r.country].filter(Boolean);
        setAddress(parts.join("، ") || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      });
    } catch {
      // silent
    }
  };

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const mk = window.mapkit;
    let map: any;
    let annotation: any;

    try {
      const center = new mk.Coordinate(coords.lat, coords.lng);
      const span = new mk.CoordinateSpan(0.01, 0.01);
      const region = new mk.CoordinateRegion(center, span);

      map = new mk.Map(containerRef.current, {
        region,
        showsCompass: mk.FeatureVisibility.Hidden,
        showsZoomControl: true,
        showsMapTypeControl: false,
      });

      annotation = new mk.MarkerAnnotation(center, {
        color: "#c9a96e",
        glyphColor: "#fff",
        draggable: true,
      });

      annotation.addEventListener("drag-end", () => {
        const { latitude, longitude } = annotation.coordinate;
        setCoords({ lat: latitude, lng: longitude });
        reverseGeocode(latitude, longitude);
      });

      map.addEventListener("single-tap", (event: any) => {
        try {
          const pt = event.pointOnPage;
          const coordinate = map.convertPointOnPageToCoordinate(pt);
          if (!coordinate) return;
          annotation.coordinate = coordinate;
          setCoords({ lat: coordinate.latitude, lng: coordinate.longitude });
          reverseGeocode(coordinate.latitude, coordinate.longitude);
        } catch {
          // ignore
        }
      });

      map.addAnnotation(annotation);
      annotationRef.current = annotation;
      mapRef.current = map;

      // Initial reverse geocode for the default position
      reverseGeocode(coords.lat, coords.lng);
    } catch (e) {
      console.error("[LocationMap] init error:", e);
    }

    return () => {
      try { map?.destroy(); } catch { /* */ }
      mapRef.current = null;
      annotationRef.current = null;
    };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const moveMapTo = (lat: number, lng: number) => {
    try {
      const mk = window.mapkit;
      const coord = new mk.Coordinate(lat, lng);
      if (annotationRef.current) annotationRef.current.coordinate = coord;
      if (mapRef.current) {
        const span = new mk.CoordinateSpan(0.01, 0.01);
        const region = new mk.CoordinateRegion(coord, span);
        if (typeof mapRef.current.setRegionAnimated === "function") {
          mapRef.current.setRegionAnimated(region, true);
        } else if (typeof mapRef.current.setCenterAnimated === "function") {
          mapRef.current.setCenterAnimated(coord, true);
        } else {
          mapRef.current.region = region;
        }
      }
    } catch (e) {
      console.warn("[LocationMap] moveMapTo error:", e);
    }
  };

  const getCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast({ title: "غير مدعوم", description: "المتصفح لا يدعم تحديد الموقع", variant: "destructive" });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const newCoords = { lat: c.latitude, lng: c.longitude };
        setCoords(newCoords);
        moveMapTo(c.latitude, c.longitude);
        reverseGeocode(c.latitude, c.longitude);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        const msg =
          err.code === 1 ? "يرجى السماح بالوصول إلى موقعك في إعدادات المتصفح" :
          err.code === 2 ? "تعذّر تحديد الموقع، حاول مرة أخرى" :
          "انتهت مهلة تحديد الموقع";
        toast({ title: "تعذّر تحديد الموقع", description: msg, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleConfirm = () => {
    const finalAddress = address || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    onLocationSelect(coords, finalAddress);
  };

  if (error) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center bg-gray-100 rounded border border-black/5 text-gray-400 text-sm gap-2">
        <MapPin className="w-5 h-5" />
        <span>تعذّر تحميل الخريطة</span>
        <span className="text-xs">يمكنك إدخال العنوان يدوياً</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!ready && (
        <div className="h-[300px] bg-gray-100 rounded border border-black/5 animate-pulse flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
        </div>
      )}
      <div
        ref={containerRef}
        style={{ height: 300, display: ready ? "block" : "none" }}
        className="rounded border border-black/5 overflow-hidden"
      />

      {address && (
        <p className="text-xs text-black/60 font-medium flex items-center gap-1">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          {address}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={getCurrentLocation}
          disabled={loading || !ready}
          className="flex-1 border-black/10"
          data-testid="button-locate-me"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              جاري التحديد...
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4 mr-2" />
              موقعي الحالي
            </>
          )}
        </Button>

        <Button
          onClick={handleConfirm}
          disabled={!ready}
          className="flex-1 bg-primary text-white"
          data-testid="button-confirm-location"
        >
          <MapPin className="w-4 h-4 mr-2" />
          تأكيد الموقع
        </Button>
      </div>

      <p className="text-[10px] text-black/40 font-bold">
        يمكنك سحب العلامة أو النقر على الخريطة لتحديد الموقع بدقة
      </p>
    </div>
  );
}
