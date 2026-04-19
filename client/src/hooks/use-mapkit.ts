import { useEffect, useState } from "react";

declare global {
  interface Window {
    mapkit: any;
    _mapkitLoaded?: boolean;
    _mapkitLoading?: boolean;
    _mapkitCallbacks?: (() => void)[];
  }
}

let _token: string | null = null;
let _tokenExpiry = 0;

async function fetchToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;
  const res = await fetch("/api/maps/token");
  const data = await res.json();
  _token = data.token;
  _tokenExpiry = Date.now() + 25 * 60 * 1000;
  return _token!;
}

export function useMapKit() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (window._mapkitLoaded) {
      setReady(true);
      return;
    }

    if (window._mapkitLoading) {
      if (!window._mapkitCallbacks) window._mapkitCallbacks = [];
      window._mapkitCallbacks.push(() => setReady(true));
      return;
    }

    window._mapkitLoading = true;
    window._mapkitCallbacks = [];

    const script = document.createElement("script");
    script.src = "https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js";
    script.crossOrigin = "anonymous";
    script.async = true;

    script.onload = async () => {
      try {
        const token = await fetchToken();
        window.mapkit.init({
          authorizationCallback: (done: (t: string) => void) => done(token),
          language: document.documentElement.lang || "ar",
        });
        window._mapkitLoaded = true;
        window._mapkitLoading = false;
        setReady(true);
        (window._mapkitCallbacks || []).forEach((cb) => cb());
      } catch (e) {
        setError("فشل تحميل الخريطة");
        window._mapkitLoading = false;
      }
    };

    script.onerror = () => {
      setError("فشل تحميل خرائط آبل");
      window._mapkitLoading = false;
    };

    document.head.appendChild(script);
  }, []);

  return { ready, error };
}
