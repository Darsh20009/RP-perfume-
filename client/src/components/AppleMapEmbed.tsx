import { useEffect, useRef } from "react";
import { useMapKit } from "@/hooks/use-mapkit";
import { MapPin } from "lucide-react";

interface AppleMapEmbedProps {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
  zoom?: number;
}

export function AppleMapEmbed({ lat, lng, label = "", height = 200, zoom = 15 }: AppleMapEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const { ready, error } = useMapKit();

  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return;

    const mk = window.mapkit;

    const center = new mk.Coordinate(lat, lng);
    const region = new mk.CoordinateRegion(
      center,
      new mk.CoordinateSpan(0.005 / zoom * 15, 0.005 / zoom * 15)
    );

    const map = new mk.Map(containerRef.current, {
      region,
      showsCompass: mk.FeatureVisibility.Hidden,
      showsZoomControl: false,
      showsMapTypeControl: false,
      isScrollEnabled: false,
      isZoomEnabled: false,
      isRotationEnabled: false,
    });

    const annotation = new mk.MarkerAnnotation(center, {
      title: label,
      color: "#c9a96e",
      glyphColor: "#fff",
    });
    map.addAnnotation(annotation);

    mapRef.current = map;

    return () => {
      map.destroy();
      mapRef.current = null;
    };
  }, [ready, lat, lng, label, zoom]);

  if (error) {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center bg-gray-100 rounded text-gray-400 gap-2 text-sm"
      >
        <MapPin className="w-5 h-5" />
        <span>{label || "الموقع"}</span>
      </div>
    );
  }

  if (!ready) {
    return (
      <div
        style={{ height }}
        className="bg-gray-100 rounded animate-pulse"
      />
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: "100%" }}
      className="rounded overflow-hidden"
    />
  );
}
