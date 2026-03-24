import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the client's IP from headers
    const forwarded = req.headers.get("x-forwarded-for");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || "";

    // Use ip-api.com (free, no key needed, 45 req/min)
    const geoRes = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,country,countryCode,city,regionName,lat,lon`);
    const geo = await geoRes.json();

    if (geo.status !== "success") {
      return new Response(
        JSON.stringify({ success: false, error: "Could not determine location" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          country: geo.country,
          countryCode: geo.countryCode,
          city: geo.city,
          region: geo.regionName,
          latitude: geo.lat,
          longitude: geo.lon,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("detect-location error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
