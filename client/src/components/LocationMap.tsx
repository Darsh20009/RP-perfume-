import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { MapPin, Loader2 } from 'lucide-react';

interface LocationMapProps {
  onLocationSelect: (coords: { lat: number; lng: number }, address: string) => void;
  initialLat?: number;
  initialLng?: number;
}

export function LocationMap({ onLocationSelect, initialLat = 24.7136, initialLng = 46.6753 }: LocationMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState({ lat: initialLat, lng: initialLng });

  useEffect(() => {
    if (!mapContainer.current) return;

    map.current = L.map(mapContainer.current).setView([initialLat, initialLng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map.current);

    marker.current = L.marker([initialLat, initialLng], {
      draggable: true,
    }).addTo(map.current);

    marker.current.on('dragend', async () => {
      const position = marker.current!.getLatLng();
      setSelectedCoords({ lat: position.lat, lng: position.lng });
    });

    map.current.on('click', (e) => {
      if (marker.current) {
        marker.current.setLatLng(e.latlng);
        setSelectedCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    });

    return () => {
      map.current?.remove();
    };
  }, [initialLat, initialLng]);

  const getCurrentLocation = () => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (map.current && marker.current) {
          map.current.setView([latitude, longitude], 15);
          marker.current.setLatLng([latitude, longitude]);
          setSelectedCoords({ lat: latitude, lng: longitude });
        }
        setLoading(false);
      },
      () => {
        setLoading(false);
        alert('لم يتم تفعيل خدمة الموقع');
      }
    );
  };

  const handleConfirm = () => {
    const address = `الإحداثيات: ${selectedCoords.lat.toFixed(4)}, ${selectedCoords.lng.toFixed(4)}`;
    onLocationSelect(selectedCoords, address);
  };

  return (
    <div className="space-y-4">
      <div ref={mapContainer} style={{ height: '300px' }} className="rounded border border-black/5" />
      
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={getCurrentLocation}
          disabled={loading}
          className="flex-1 border-black/10"
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
          className="flex-1 bg-primary text-white"
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
