import { useState, useEffect, useRef, useMemo, useCallback, memo, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { SEOHead } from "@/components/SEOHead";
import { useNavigate, Link } from "react-router-dom";
import { SearchBarWithSuggestions } from "@/components/SearchBarWithSuggestions";
import { useSearchFocus } from "@/components/PageLayout";
import { ListingCard } from "@/components/ListingCard";
import { Calendar, Hotel, Tent, Compass, MapPin, ChevronLeft, ChevronRight, Loader2, Navigation, Home } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useGeolocation, calculateDistance } from "@/hooks/useGeolocation";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { useSavedItems } from "@/hooks/useSavedItems";
import { getCachedHomePageData, setCachedHomePageData } from "@/hooks/useHomePageCache";
import { useRatings, sortByRating } from "@/hooks/useRatings";
import { useRealtimeBookings } from "@/hooks/useRealtimeBookings";
import { useResponsiveLimit } from "@/hooks/useResponsiveLimit";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

// ─── Memoized horizontal scroll section ─────────────────────────────────────
interface ScrollSectionProps {
  title: string;
  viewAllPath: string;
  accentClass: string;
  children: React.ReactNode;
  scrollRef: React.RefObject<HTMLDivElement>;
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  hasItems: boolean;
  loading: boolean;
}

const ScrollSection = memo(({ title, viewAllPath, accentClass, children, scrollRef, onScroll, hasItems, loading }: ScrollSectionProps) => {
  const scroll = useCallback((dir: 'left' | 'right') => {
    scrollRef.current?.scrollTo({
      left: scrollRef.current.scrollLeft + (dir === 'left' ? -320 : 320),
      behavior: 'smooth',
    });
  }, [scrollRef]);

  return (
    <section className="mb-4 md:mb-8">
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h2 className={`text-base sm:text-xl md:text-2xl font-extrabold tracking-tight ${accentClass}`}>
          {title}
        </h2>
        <Link
          to={viewAllPath}
          className="text-xs md:text-sm font-semibold text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          View all →
        </Link>
      </div>
      <div className="relative group">
        {hasItems && (
          <>
            <Button
              variant="ghost" size="icon" aria-label="Scroll left"
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md border border-border text-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost" size="icon" aria-label="Scroll right"
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/90 shadow-md border border-border text-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory"
        >
          {loading || !hasItems ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-[72vw] sm:w-[280px] md:w-[320px] snap-start">
                <ListingSkeleton />
              </div>
            ))
          ) : children}
        </div>
      </div>
    </section>
  );
});
ScrollSection.displayName = "ScrollSection";

// ─── Category pill data ──────────────────────────────────────────────────────
const CATEGORIES = [
  { icon: Tent, title: "Adventures", path: "/category/campsite", color: "hsl(var(--primary))" },
  { icon: Hotel, title: "Hotels", path: "/category/hotels", color: "hsl(180, 100%, 30%)" },
  { icon: Calendar, title: "Trips", path: "/category/trips", color: "hsl(0, 72%, 51%)" },
  { icon: Compass, title: "Events", path: "/category/events", color: "hsl(16, 100%, 66%)" },
  { icon: Home, title: "Stays", path: "/category/accommodation", color: "hsl(270, 50%, 55%)" },
];

// ─── Main component ──────────────────────────────────────────────────────────
const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [listings, setListings] = useState<any[]>([]);
  const { savedItems, handleSave } = useSavedItems();
  const [loading, setLoading] = useState(true);
  const [hasMoreSearchResults, setHasMoreSearchResults] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const { position, loading: locationLoading, permissionDenied, requestLocation, forceRequestLocation } = useGeolocation();
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const { cardLimit, isLargeScreen } = useResponsiveLimit();

  const [isSearchVisible, setIsSearchVisible] = useState(true);
  const [showSearchIcon, setShowSearchIcon] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [scrollableRows, setScrollableRows] = useState<{
    trips: any[]; hotels: any[]; attractions: any[];
    campsites: any[]; events: any[]; accommodations: any[];
  }>({ trips: [], hotels: [], attractions: [], campsites: [], events: [], accommodations: [] });
  const [nearbyPlacesHotels, setNearbyPlacesHotels] = useState<any[]>([]);
  const [loadingScrollable, setLoadingScrollable] = useState(true);
  const [loadingNearby, setLoadingNearby] = useState(true);
  const [isSearchFocused, setIsSearchFocusedLocal] = useState(false);
  const { setSearchFocused } = useSearchFocus();

  const setIsSearchFocused = useCallback((v: boolean) => {
    setIsSearchFocusedLocal(v);
    setSearchFocused(v);
  }, [setSearchFocused]);

  // Collect all item IDs for ratings
  const allItemIds = useMemo(() => {
    const ids = new Set<string>();
    listings.forEach(item => ids.add(item.id));
    nearbyPlacesHotels.forEach(item => ids.add(item.id));
    scrollableRows.trips.forEach(item => ids.add(item.id));
    scrollableRows.hotels.forEach(item => ids.add(item.id));
    scrollableRows.campsites.forEach(item => ids.add(item.id));
    scrollableRows.events.forEach(item => ids.add(item.id));
    return Array.from(ids);
  }, [listings, nearbyPlacesHotels, scrollableRows]);

  const tripEventIds = useMemo(() => {
    const ids = [...scrollableRows.trips, ...scrollableRows.events].map(item => item.id);
    listings.forEach(item => {
      if (item.type === "TRIP" || item.type === "EVENT") ids.push(item.id);
    });
    return [...new Set(ids)];
  }, [scrollableRows.trips, scrollableRows.events, listings]);

  const { bookingStats } = useRealtimeBookings(tripEventIds);
  const { ratings } = useRatings(allItemIds);

  const sortedListings = useMemo(() => sortByRating(listings, ratings, position, calculateDistance), [listings, ratings, position]);
  const sortedNearbyPlaces = useMemo(() => sortByRating(nearbyPlacesHotels, ratings, position, calculateDistance), [nearbyPlacesHotels, ratings, position]);
  const sortedEvents = useMemo(() => sortByRating(scrollableRows.events, ratings, position, calculateDistance), [scrollableRows.events, ratings, position]);
  const sortedCampsites = useMemo(() => sortByRating(scrollableRows.campsites, ratings, position, calculateDistance), [scrollableRows.campsites, ratings, position]);
  const sortedHotels = useMemo(() => sortByRating(scrollableRows.hotels, ratings, position, calculateDistance), [scrollableRows.hotels, ratings, position]);
  const sortedTrips = useMemo(() => sortByRating(scrollableRows.trips, ratings, position, calculateDistance), [scrollableRows.trips, ratings, position]);

  // Scroll refs
  const featuredCampsitesRef = useRef<HTMLDivElement>(null);
  const featuredEventsRef = useRef<HTMLDivElement>(null);
  const featuredHotelsRef = useRef<HTMLDivElement>(null);
  const featuredTripsRef = useRef<HTMLDivElement>(null);

  const [scrollPositions, setScrollPositions] = useState<Record<string, number>>({});

  const [listingViewMode, setListingViewMode] = useState<'top_destinations' | 'my_location'>('top_destinations');

  const handleScroll = useCallback((sectionName: string) => (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setScrollPositions(prev => ({ ...prev, [sectionName]: target.scrollLeft }));
  }, []);

  // ─── Data fetching ─────────────────────────────────────────────────────────
  const fetchScrollableRows = useCallback(async (limit: number) => {
    setLoadingScrollable(true);
    const fetchLimit = Math.max(limit * 3, 30);
    try {
      const [tripsData, hotelsData, campsitesData, eventsData] = await Promise.all([
        supabase.from("trips").select("id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child")
          .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip").order("date", { ascending: true }).limit(fetchLimit),
        supabase.from("hotels").select("id,name,location,place,country,image_url,activities,latitude,longitude,created_at,establishment_type")
          .eq("approval_status", "approved").eq("is_hidden", false).limit(fetchLimit),
        supabase.from("adventure_places").select("id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at")
          .eq("approval_status", "approved").eq("is_hidden", false).limit(fetchLimit),
        supabase.from("trips").select("id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child")
          .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "event").order("date", { ascending: true }).limit(fetchLimit),
      ]);
      setScrollableRows({
        trips: tripsData.data || [], hotels: hotelsData.data || [],
        attractions: [], campsites: campsitesData.data || [],
        events: eventsData.data || [], accommodations: [],
      });
    } catch (error) {
      console.error("Error fetching scrollable rows:", error);
    } finally {
      setLoadingScrollable(false);
    }
  }, []);

  const fetchNearbyPlacesAndHotels = useCallback(async () => {
    setLoadingNearby(true);
    if (!position) return;
    const [placesData, hotelsData] = await Promise.all([
      supabase.from("adventure_places").select("id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at")
        .eq("approval_status", "approved").eq("is_hidden", false).limit(12),
      supabase.from("hotels").select("id,name,location,place,country,image_url,activities,latitude,longitude,created_at")
        .eq("approval_status", "approved").eq("is_hidden", false).limit(12),
    ]);
    const combined = [
      ...(placesData.data || []).map(item => ({ ...item, type: "ADVENTURE PLACE", table: "adventure_places" })),
      ...(hotelsData.data || []).map(item => ({ ...item, type: "HOTEL", table: "hotels" })),
    ];
    const withDistance = combined.map(item => {
      const dist = (item as any).latitude && (item as any).longitude && position
        ? calculateDistance(position.latitude, position.longitude, (item as any).latitude, (item as any).longitude) : undefined;
      return { ...item, distance: dist };
    }).sort((a, b) => {
      if (a.distance !== undefined && b.distance !== undefined) return a.distance - b.distance;
      if (a.distance !== undefined) return -1;
      if (b.distance !== undefined) return 1;
      return 0;
    });
    const nearby = withDistance.slice(0, 12);
    setNearbyPlacesHotels(nearby);
    if (nearby.length > 0) setLoadingNearby(false);
  }, [position]);

  const fetchAllData = useCallback(async (query?: string, offset: number = 0, limit: number = 15) => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const fetchEvents = async () => {
      let dbQuery = supabase.from("trips").select("id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child")
        .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "event").or(`date.gte.${today},is_flexible_date.eq.true`);
      if (query) { const p = `%${query}%`; dbQuery = dbQuery.or(`name.ilike.${p},location.ilike.${p},country.ilike.${p}`); }
      dbQuery = dbQuery.order('date', { ascending: true }).range(offset, offset + limit - 1);
      const { data } = await dbQuery;
      return (data || []).map((item: any) => ({ ...item, type: "EVENT" }));
    };
    const fetchTable = async (table: "hotels" | "adventure_places", type: string) => {
      let dbQuery = supabase.from(table).select(table === "hotels"
        ? "id,name,location,place,country,image_url,activities,latitude,longitude,created_at"
        : "id,name,location,place,country,image_url,entry_fee,activities,latitude,longitude,created_at")
        .eq("approval_status", "approved").eq("is_hidden", false);
      if (query) { const p = `%${query}%`; dbQuery = dbQuery.or(`name.ilike.${p},location.ilike.${p},country.ilike.${p}`); }
      dbQuery = dbQuery.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
      const { data } = await dbQuery;
      return (data || []).map((item: any) => ({ ...item, type }));
    };
    const fetchTrips = async () => {
      let dbQuery = supabase.from("trips").select("id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child")
        .eq("approval_status", "approved").eq("is_hidden", false).eq("type", "trip");
      if (query) { const p = `%${query}%`; dbQuery = dbQuery.or(`name.ilike.${p},location.ilike.${p},country.ilike.${p}`); }
      dbQuery = dbQuery.order('date', { ascending: true }).range(offset, offset + limit - 1);
      const { data } = await dbQuery;
      return (data || []).map((item: any) => ({ ...item, type: "TRIP" }));
    };

    const [events, trips, hotels, adventures] = await Promise.all([fetchEvents(), fetchTrips(), fetchTable("hotels", "HOTEL"), fetchTable("adventure_places", "ADVENTURE PLACE")]);
    let combined = [...hotels, ...adventures, ...trips, ...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (offset === 0) { setListings(combined); setHasMoreSearchResults(true); }
    else { setListings(prev => [...prev, ...combined]); }
    if (combined.length < limit) setHasMoreSearchResults(false);
    setLoading(false);
    return combined;
  }, [position]);

  const loadMoreSearchResults = useCallback(async () => {
    if (loading || !searchQuery || !hasMoreSearchResults) return;
    const prevLength = listings.length;
    await fetchAllData(searchQuery, listings.length, 20);
    if (listings.length === prevLength) setHasMoreSearchResults(false);
  }, [loading, searchQuery, listings.length, hasMoreSearchResults, fetchAllData]);

  // ─── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleInteraction = () => { requestLocation(); window.removeEventListener('scroll', handleInteraction); window.removeEventListener('click', handleInteraction); };
    window.addEventListener('scroll', handleInteraction, { once: true });
    window.addEventListener('click', handleInteraction, { once: true });
    return () => { window.removeEventListener('scroll', handleInteraction); window.removeEventListener('click', handleInteraction); };
  }, [requestLocation]);

  useEffect(() => {
    if (!searchQuery || !hasMoreSearchResults) return;
    const handleScrollEvent = () => {
      if (loading || !hasMoreSearchResults) return;
      if (document.documentElement.scrollTop + document.documentElement.clientHeight >= document.documentElement.scrollHeight - 500) loadMoreSearchResults();
    };
    window.addEventListener('scroll', handleScrollEvent);
    return () => window.removeEventListener('scroll', handleScrollEvent);
  }, [loading, searchQuery, hasMoreSearchResults, loadMoreSearchResults]);

  useEffect(() => {
    const cachedData = getCachedHomePageData();
    if (cachedData) {
      setListings(cachedData.listings || []);
      const c = cachedData.scrollableRows as any || {};
      setScrollableRows({ trips: c.trips || [], hotels: c.hotels || [], attractions: c.attractions || [], campsites: c.campsites || [], events: c.events || [], accommodations: c.accommodations || [] });
      setNearbyPlacesHotels(cachedData.nearbyPlacesHotels || []);
      setLoading(false); setLoadingScrollable(false); setLoadingNearby(false);
    }
    fetchAllData();
    fetchScrollableRows(cardLimit);
    getUserId().then(setUserId);
  }, [cardLimit, fetchScrollableRows, fetchAllData]);

  useEffect(() => {
    if (!loading && !loadingScrollable && listings.length > 0) {
      setCachedHomePageData({ scrollableRows, listings, nearbyPlacesHotels });
    }
  }, [loading, loadingScrollable, listings, scrollableRows, nearbyPlacesHotels]);

  useEffect(() => { if (position) fetchNearbyPlacesAndHotels(); }, [position, fetchNearbyPlacesAndHotels]);

  useEffect(() => {
    const ctrl = () => {
      if (window.scrollY > 200) { setIsSearchVisible(false); setShowSearchIcon(true); }
      else { setIsSearchVisible(true); setShowSearchIcon(false); }
    };
    window.addEventListener("scroll", ctrl);
    return () => window.removeEventListener("scroll", ctrl);
  }, []);

  const handleSearchIconClick = () => { setIsSearchVisible(true); setShowSearchIcon(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleMyLocationTap = useCallback(() => {
    if (permissionDenied) { setShowLocationDialog(true); return; }
    if (!position && !locationLoading) forceRequestLocation();
    setListingViewMode('my_location');
  }, [position, locationLoading, permissionDenied, forceRequestLocation]);

  useEffect(() => { if (permissionDenied && listingViewMode === 'my_location') setShowLocationDialog(true); }, [permissionDenied, listingViewMode]);

  // ─── Display items with filtering ─────────────────────────────────────────
  const getDisplayItems = useCallback((items: any[], sortedByRating: any[], isTripsOrEvents = false) => {
    let result = listingViewMode === 'my_location' && position
      ? [...items].sort((a, b) => {
          const distA = a.latitude && a.longitude ? calculateDistance(position.latitude, position.longitude, a.latitude, a.longitude) : Infinity;
          const distB = b.latitude && b.longitude ? calculateDistance(position.latitude, position.longitude, b.latitude, b.longitude) : Infinity;
          return distA - distB;
        })
      : sortedByRating;

    if (isTripsOrEvents) {
      const today = new Date().toISOString().split('T')[0];
      const flexible: any[] = [], fixed: any[] = [];
      result.forEach(item => {
        if (item.date && !item.is_flexible_date && item.date < today) return;
        const bookedCount = bookingStats[item.id] || 0;
        if (!item.is_flexible_date && item.available_tickets != null && (item.available_tickets <= 0 || bookedCount >= item.available_tickets)) return;
        (item.is_flexible_date ? flexible : fixed).push(item);
      });
      return [...flexible, ...fixed];
    }
    return result;
  }, [listingViewMode, position, bookingStats]);

  const displayCampsites = useMemo(() => getDisplayItems(scrollableRows.campsites, sortedCampsites), [scrollableRows.campsites, sortedCampsites, getDisplayItems]);
  const displayHotels = useMemo(() => getDisplayItems(scrollableRows.hotels, sortedHotels), [scrollableRows.hotels, sortedHotels, getDisplayItems]);
  const displayTrips = useMemo(() => getDisplayItems(scrollableRows.trips, sortedTrips, true), [scrollableRows.trips, sortedTrips, getDisplayItems]);
  const displayEvents = useMemo(() => getDisplayItems(scrollableRows.events, sortedEvents, true), [scrollableRows.events, sortedEvents, getDisplayItems]);

  // ─── Render helpers ────────────────────────────────────────────────────────
  const renderCard = useCallback((item: any, type: string, index: number, opts: { hidePrice?: boolean; isTrip?: boolean } = {}) => {
    const itemDistance = position && item.latitude && item.longitude ? calculateDistance(position.latitude, position.longitude, item.latitude, item.longitude) : undefined;
    const ratingData = ratings.get(item.id);
    const today = new Date().toISOString().split('T')[0];
    const isOutdated = item.date && !item.is_flexible_date && item.date < today;
    return (
      <div key={item.id} className="flex-shrink-0 w-[72vw] sm:w-[280px] md:w-[320px] snap-start">
        <ListingCard
          id={item.id} type={type as any} name={item.name}
          imageUrl={item.image_url} location={item.location} country={item.country}
          price={item.price || item.entry_fee || 0} date={item.date || ""}
          isCustomDate={item.is_custom_date} isFlexibleDate={item.is_flexible_date}
          isOutdated={isOutdated}
          onSave={handleSave} isSaved={savedItems.has(item.id)}
          hidePrice={opts.hidePrice ?? false}
          showBadge={true} priority={index === 0}
          activities={item.activities} distance={itemDistance}
          avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount}
          place={item.place}
          availableTickets={opts.isTrip ? item.available_tickets : undefined}
          bookedTickets={opts.isTrip ? bookingStats[item.id] || 0 : undefined}
        />
      </div>
    );
  }, [position, ratings, savedItems, handleSave, bookingStats]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Realtravo - Book Trips, Hotels & Adventures"
        description="Discover and book exciting trips, events, hotels, and adventure experiences. Your gateway to unforgettable travel."
        canonical="https://realtravo.com/"
        ogImage="https://realtravo.com/fulllogo.png"
        jsonLd={{
          "@context": "https://schema.org", "@type": "WebSite", "name": "Realtravo", "url": "https://realtravo.com",
          "potentialAction": { "@type": "SearchAction", "target": "https://realtravo.com/?q={search_term_string}", "query-input": "required name=search_term_string" }
        }}
      />

      {/* ─── Hero ──────────────────────────────────────────────────────────── */}
      {!isSearchFocused && (
        <div ref={searchRef} className="relative w-full h-[52vh] md:h-[44vh] overflow-hidden">
          <div className="absolute inset-0 bg-foreground/80" />
          <picture>
            <source srcSet="/images/hero-background.webp" type="image/webp" />
            <img
              src="/images/hero-background.webp"
              alt="Travel destination"
              fetchPriority="high" decoding="async" loading="eager"
              width={1920} height={1080}
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pb-28 md:pb-20 px-4">
            <div className="container max-w-2xl">
              <p className="text-primary-foreground/70 text-xs md:text-sm font-semibold uppercase tracking-widest text-center mb-2">
                {t('hero.tagline')}
              </p>
              <h1 className="text-primary-foreground text-3xl md:text-5xl font-extrabold text-center mb-5 md:mb-7 leading-tight tracking-tight">
                {t('hero.title')}
              </h1>
              <SearchBarWithSuggestions
                value={searchQuery} onChange={setSearchQuery}
                onSubmit={() => { if (searchQuery.trim()) { fetchAllData(searchQuery); setIsSearchFocused(true); } }}
                onSuggestionSearch={q => { setSearchQuery(q); fetchAllData(q); setIsSearchFocused(true); }}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => {}}
                onBack={() => { setIsSearchFocused(false); setSearchQuery(""); fetchAllData(); }}
                showBackButton={false}
              />
              {/* Category pills */}
              <div className="flex justify-center gap-2 md:gap-3 flex-wrap mt-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.title}
                    onClick={() => navigate(cat.path)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full backdrop-blur-md border border-white/20 transition-all hover:scale-105 active:scale-95"
                    style={{ backgroundColor: `${cat.color}CC` }}
                  >
                    <cat.icon className="h-3.5 w-3.5 text-white" />
                    <span className="text-[11px] md:text-xs font-bold text-white">{cat.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Focused search bar ────────────────────────────────────────────── */}
      {isSearchFocused && (
        <div className="sticky top-0 z-50 bg-background p-4 border-b shadow-sm">
          <div className="container px-4 mx-auto">
            <SearchBarWithSuggestions
              value={searchQuery} onChange={setSearchQuery}
              onSubmit={() => { if (searchQuery.trim()) fetchAllData(searchQuery); }}
              onSuggestionSearch={q => { setSearchQuery(q); fetchAllData(q); }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {}}
              onBack={() => { setIsSearchFocused(false); setSearchQuery(""); fetchAllData(); }}
              showBackButton={true}
            />
          </div>
        </div>
      )}

      <main className="w-full">
        {/* ─── Search results ────────────────────────────────────────────── */}
        {isSearchFocused && (
          <div className="container mx-auto px-4 md:px-6 mt-6 pb-20 md:pb-8">
            <h2 className="text-lg md:text-xl font-bold mb-5 text-foreground">
              {searchQuery ? t('sections.searchResults') : t('sections.allListings')}
            </h2>
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                {[...Array(8)].map((_, i) => <ListingSkeleton key={i} />)}
              </div>
            ) : sortedListings.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-muted-foreground text-sm">{t('sections.noResults')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                {sortedListings.map((listing, index) => {
                  const itemDistance = position && listing.latitude && listing.longitude ? calculateDistance(position.latitude, position.longitude, listing.latitude, listing.longitude) : undefined;
                  const ratingData = ratings.get(listing.id);
                  const isTripsOrEvents = listing.type === "TRIP" || listing.type === "EVENT";
                  const today = new Date().toISOString().split('T')[0];
                  const isOutdated = listing.date && !listing.is_flexible_date && listing.date < today;
                  return (
                    <ListingCard
                      key={listing.id} id={listing.id} type={listing.type}
                      name={listing.name} location={listing.location} country={listing.country}
                      imageUrl={listing.image_url} price={listing.price || listing.entry_fee || 0}
                      date={listing.date} isCustomDate={listing.is_custom_date}
                      isFlexibleDate={listing.is_flexible_date} isOutdated={isOutdated}
                      isSaved={savedItems.has(listing.id)} onSave={() => handleSave(listing.id, listing.type)}
                      availableTickets={isTripsOrEvents ? listing.available_tickets : undefined}
                      bookedTickets={isTripsOrEvents ? bookingStats[listing.id] || 0 : undefined}
                      showBadge={true} priority={index < 4}
                      hidePrice={listing.type === "HOTEL" || listing.type === "ADVENTURE PLACE"}
                      activities={listing.activities} distance={itemDistance}
                      avgRating={ratingData?.avgRating} reviewCount={ratingData?.reviewCount}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── Browse sections ───────────────────────────────────────────── */}
        <div className={`w-full ${isSearchFocused ? 'hidden' : ''}`}>
          {/* View toggle */}
          <div className="container mx-auto px-4 md:px-6 pt-4 pb-2 md:pt-5 md:pb-3">
            <div className="flex items-center gap-1 bg-muted rounded-full p-1 w-fit">
              <button
                onClick={() => setListingViewMode('top_destinations')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  listingViewMode === 'top_destinations'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('sections.topDestinations')}
              </button>
              <button
                onClick={!locationLoading ? handleMyLocationTap : undefined}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                  listingViewMode === 'my_location'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                } ${locationLoading ? 'opacity-70 cursor-wait' : ''}`}
              >
                {locationLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                {locationLoading ? t('sections.finding') : t('sections.nearMe')}
              </button>
            </div>
          </div>

          <div className="container mx-auto px-4 md:px-6 py-3 md:py-5 space-y-2 md:space-y-4">
            {/* Adventures */}
            <ScrollSection
              title={t('sections.placesToAdventure')} viewAllPath="/category/campsite"
              accentClass="text-primary" scrollRef={featuredCampsitesRef}
              onScroll={handleScroll('featuredCampsites')}
              hasItems={displayCampsites.length > 0} loading={loadingScrollable}
            >
              {displayCampsites.map((place, i) => renderCard(place, "ADVENTURE PLACE", i, { hidePrice: true }))}
            </ScrollSection>

            {/* Hotels */}
            <ScrollSection
              title={t('sections.hotelsAccommodations')} viewAllPath="/category/hotels"
              accentClass="text-[hsl(180,100%,25%)]" scrollRef={featuredHotelsRef}
              onScroll={handleScroll('featuredHotels')}
              hasItems={displayHotels.length > 0} loading={loadingScrollable}
            >
              {displayHotels.map((hotel, i) => renderCard(hotel, "HOTEL", i, { hidePrice: true }))}
            </ScrollSection>

            {/* Trips */}
            <ScrollSection
              title={t('sections.tripsAndTours')} viewAllPath="/category/trips"
              accentClass="text-destructive" scrollRef={featuredTripsRef}
              onScroll={handleScroll('featuredTrips')}
              hasItems={displayTrips.length > 0} loading={loadingScrollable}
            >
              {displayTrips.map((trip, i) => renderCard(trip, trip.type === "event" ? "EVENT" : "TRIP", i, { isTrip: true }))}
            </ScrollSection>

            {/* Events */}
            <ScrollSection
              title={t('sections.sportsAndEvents')} viewAllPath="/category/events"
              accentClass="text-[hsl(16,100%,66%)]" scrollRef={featuredEventsRef}
              onScroll={handleScroll('featuredEvents')}
              hasItems={displayEvents.length > 0} loading={loadingScrollable}
            >
              {displayEvents.map((event, i) => renderCard(event, "EVENT", i, { isTrip: true }))}
            </ScrollSection>

            {/* Nearest */}
            {position && sortedNearbyPlaces.length > 0 && (
              <section className="mb-4 md:mb-8">
                <div className="flex items-center gap-2 mb-3 md:mb-4">
                  <MapPin className="h-4 w-4 md:h-5 md:w-5 text-blue-500" />
                  <h2 className="text-base sm:text-xl md:text-2xl font-extrabold tracking-tight text-blue-500">
                    {t('sections.nearestToYou')}
                  </h2>
                </div>
                <div className="flex gap-3 md:gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth snap-x snap-mandatory">
                  {loadingNearby ? (
                    [...Array(4)].map((_, i) => (
                      <div key={i} className="flex-shrink-0 w-[72vw] sm:w-[280px] md:w-[320px] snap-start">
                        <ListingSkeleton />
                      </div>
                    ))
                  ) : sortedNearbyPlaces.slice(0, 8).map((item, index) => {
                    const a = item as any;
                    const dist = a.latitude && a.longitude && position ? calculateDistance(position.latitude, position.longitude, a.latitude, a.longitude) : undefined;
                    const rd = ratings.get(item.id);
                    return (
                      <div key={item.id} className="flex-shrink-0 w-[72vw] sm:w-[280px] md:w-[320px] snap-start">
                        <ListingCard
                          id={item.id} type={a.type || (a.table === 'hotels' ? 'HOTEL' : 'ADVENTURE PLACE')}
                          name={item.name} imageUrl={a.image_url} location={a.location} country={a.country}
                          price={a.entry_fee || 0} date="" onSave={handleSave}
                          isSaved={savedItems.has(item.id)} hidePrice={true} showBadge={true}
                          priority={index === 0} activities={a.activities} distance={dist}
                          avgRating={rd?.avgRating} reviewCount={rd?.reviewCount} place={a.place}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>

        {/* Location Permission Dialog */}
        <AlertDialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Navigation className="h-8 w-8 text-primary" />
                </div>
              </div>
              <AlertDialogTitle className="text-center">{t('location.turnOn')}</AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                {t('location.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
              <AlertDialogAction onClick={() => { setShowLocationDialog(false); forceRequestLocation(); }} className="w-full bg-primary hover:bg-primary/90">
                Try Again
              </AlertDialogAction>
              <AlertDialogAction onClick={() => { setShowLocationDialog(false); setListingViewMode('top_destinations'); }} className="w-full bg-muted text-muted-foreground hover:bg-muted/80">
                Continue Without Location
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Index;
