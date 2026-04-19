import { useEffect, useRef, useState } from "react";
import { useMapKit } from "@/hooks/use-mapkit";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";

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
  const [loading, setLoading] = useState(false);
  const [coords, setCoords] = useState({ lat: initialLat, lng: initialLng });

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const mk = window.mapkit;

    const center = new mk.Coordinate(coords.lat, coords.lng);
    const map = new mk.Map(containerRef.current, {
      center,
      cameraDistance: 1000,
      showsCompass: mk.FeatureVisibility.Hidden,
      showsZoomControl: true,
      showsMapTypeControl: false,
    });

    const annotation = new mk.MarkerAnnotation(center, {
      color: "#c9a96e",
      glyphColor: "#fff",
      draggable: true,
    });

    annotation.addEventListener("drag-end", () => {
      const { latitude, longitude } = annotation.coordinate;
      setCoords({ lat: latitude, lng: longitude });
    });

    map.addEventListener("single-tap", (event: any) => {
      const pt = event.pointOnPage;
      const coordinate = map.convertPointOnPageToCoordinate(pt);
      annotation.coordinate = coordinate;
      setCoords({ lat: coordinate.latitude, lng: coordinate.longitude });
    });

    map.addAnnotation(annotation);
    annotationRef.current = annotation;
    mapRef.current = map;

    return () => {
      map.destroy();
      mapRef.current = null;
      annotationRef.current = null;
    };
  }, [ready]);

  const getCurrentLocation = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        const newCoords = { lat: c.latitude, lng: c.longitude };
        setCoords(newCoords);
        if (mapRef.current && annotationRef.current && window.mapkit) {
          const coord = new window.mapkit.Coordinate(c.latitude, c.longitude);
          annotationRef.current.coordinate = coord;
          mapRef.current.setCenterAnimated(coord);
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
        alert("لم يتم تفعيل خدمة الموقع");
      }
    );
  };

  const handleConfirm = () => {
    const address = `الإحداثيات: ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    onLocationSelect(coords, address);
  };

  if (error) {
    return (
      <div className="h-[300px] flex items-center justify-center bg-gray-100 rounded border border-black/5 text-gray-400 text-sm gap-2">
        <MapPin className="w-4 h-4" />
        <span>تعذّر تحميل الخريطة</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!ready && (
        <div className="h-[300px] bg-gray-100 rounded border border-black/5 animate-pulse" />
      )}
      <div
        ref={containerRef}
        style={{ height: 300, display: ready ? "block" : "none" }}
        className="rounded border border-black/5 overflow-hidden"
      />

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
              <MapPin className="w-4 h-4 mr-2" />
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
          تأكيد الموقع
        </Button>
      </div>

      <p className="text-[10px] text-black/40 font-bold">
        يمكنك سحب العلامة أو النقر على الخريطة لتحديد الموقع
      </p>
    </div>
  );
}
