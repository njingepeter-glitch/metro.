import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IpLocation {
  country: string;
  countryCode: string;
  city: string;
  region: string;
  latitude: number;
  longitude: number;
}

const CACHE_KEY = "ip_location_cache";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export const useIpLocation = () => {
  const [location, setLocation] = useState<IpLocation | null>(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) return data;
      }
    } catch {}
    return null;
  });
  const [loading, setLoading] = useState(!location);

  useEffect(() => {
    if (location) return;

    let cancelled = false;
    const detect = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("detect-location");
        if (cancelled) return;
        if (!error && data?.success) {
          setLocation(data.data);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ data: data.data, timestamp: Date.now() }));
        }
      } catch {
        // Silent fail - IP location is best-effort
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    detect();
    return () => { cancelled = true; };
  }, [location]);

  return { location, loading };
};
