import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getUserId } from "@/lib/sessionManager";
import { useLocation } from "react-router-dom";
import { Trash2, MapPin, ChevronRight, Loader2, Lock } from "lucide-react";
import { createDetailPath } from "@/lib/slugUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { SavedItemsSkeleton } from "@/components/SavedItemsSkeleton";
import { Button } from "@/components/ui/button";
import { useSavedItems } from "@/hooks/useSavedItems";
import { useAuth } from "@/contexts/AuthContext";
import { getLocalSavedItems, removeItemLocally } from "@/hooks/useLocalSavedItems";

const ITEMS_PER_PAGE = 10;

const Saved = () => {
  const [savedListings, setSavedListings] = useState<any[]>([]);
  const { savedItems } = useSavedItems();
  const { user, loading: authLoading } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const hasFetched = useRef(false);
  const location = useLocation();
  const isEmbeddedInSheet = location.pathname !== "/saved";

  // ref so delete handler is always current inside the anchor's onClick
  const deletingRef = useRef<string | null>(null);

  useEffect(() => {
    const initializeData = async () => {
      if (authLoading) return;

      if (!user) {
        await fetchGuestSavedItems();
        return;
      }

      const uid = await getUserId();
      if (!uid) { setIsLoading(false); return; }
      setUserId(uid);
      fetchSavedItems(uid, 0);
    };
    initializeData();
  }, [authLoading, user]);

  useEffect(() => {
    if (user && userId && hasFetched.current) fetchSavedItems(userId, 0);
    if (!user && hasFetched.current) fetchGuestSavedItems();
  }, [savedItems, user, userId]);

  const fetchItemsByType = async (savedData: Array<{ item_id: string; item_type: string }>) => {
    const tripIds = savedData
      .filter(s => s.item_type === "trip" || s.item_type === "event")
      .map(s => s.item_id);
    const hotelIds = savedData
      .filter(s => s.item_type === "hotel")
      .map(s => s.item_id);
    const adventureIds = savedData
      .filter(s => s.item_type === "adventure_place" || s.item_type === "attraction" || s.item_type === "adventure")
      .map(s => s.item_id);

    const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
      tripIds.length > 0
        ? supabase.from("trips").select("id,name,location,image_url,is_hidden,type").in("id", tripIds)
        : { data: [] },
      hotelIds.length > 0
        ? supabase.from("hotels").select("id,name,location,image_url,is_hidden").in("id", hotelIds)
        : { data: [] },
      adventureIds.length > 0
        ? supabase.from("adventure_places").select("id,name,location,image_url,is_hidden").in("id", adventureIds)
        : { data: [] },
    ]);

    const itemMap = new Map();
    [
      ...(tripsRes.data || []),
      ...(hotelsRes.data || []),
      ...(adventuresRes.data || []),
    ].forEach(item => {
      if (item.is_hidden) return;
      const original = savedData.find(s => s.item_id === item.id);
      itemMap.set(item.id, { ...item, savedType: original?.item_type });
    });

    return savedData.map(s => itemMap.get(s.item_id)).filter(Boolean);
  };

  const fetchGuestSavedItems = async () => {
    setIsLoading(true);
    const localSaved = getLocalSavedItems();

    if (localSaved.length === 0) {
      setSavedListings([]);
      setHasMore(false);
      setIsLoading(false);
      hasFetched.current = true;
      return;
    }

    const localData = localSaved.map(item => ({ item_id: item.item_id, item_type: item.item_type }));
    const items = await fetchItemsByType(localData);
    setSavedListings(items);
    setHasMore(false);
    setOffset(items.length);
    setIsLoading(false);
    hasFetched.current = true;
  };

  const fetchSavedItems = async (uid: string, fetchOffset: number) => {
    if (fetchOffset === 0) setIsLoading(true);
    else setLoadingMore(true);

    const { data: savedData } = await supabase
      .from("saved_items")
      .select("item_id, item_type")
      .eq("user_id", uid)
      .range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1)
      .order('created_at', { ascending: false });

    if (!savedData || savedData.length === 0) {
      if (fetchOffset === 0) setSavedListings([]);
      setHasMore(false);
      setIsLoading(false);
      setLoadingMore(false);
      return;
    }

    setHasMore(savedData.length >= ITEMS_PER_PAGE);

    const newItems = await fetchItemsByType(savedData);
    if (fetchOffset === 0) {
      setSavedListings(newItems);
    } else {
      setSavedListings(prev => [...prev, ...newItems]);
    }
    setOffset(fetchOffset + ITEMS_PER_PAGE);
    hasFetched.current = true;
    setIsLoading(false);
    setLoadingMore(false);
  };

  const loadMore = () => {
    if (!userId || loadingMore || !hasMore) return;
    fetchSavedItems(userId, offset);
  };

  const handleRemoveSingle = async (itemId: string, e: React.MouseEvent) => {
    // Stop the click from bubbling to the anchor card
    e.preventDefault();
    e.stopPropagation();
    if ((!user && deletingRef.current === itemId) || (user && !userId) || deletingRef.current === itemId) return;

    deletingRef.current = itemId;
    setDeletingId(itemId);

    if (!user) {
      removeItemLocally(itemId);
      setSavedListings(prev => prev.filter(item => item.id !== itemId));
      toast({ title: "Removed", description: "Item removed from offline saved items." });
      deletingRef.current = null;
      setDeletingId(null);
      return;
    }

    const { error } = await supabase
      .from("saved_items")
      .delete()
      .eq("item_id", itemId)
      .eq("user_id", userId);

    if (!error) {
      setSavedListings(prev => prev.filter(item => item.id !== itemId));
      toast({ title: "Removed", description: "Item removed from your collection." });
    }
    deletingRef.current = null;
    setDeletingId(null);
  };

  return (
    <div className={isEmbeddedInSheet ? "min-h-full bg-background" : "min-h-screen bg-[#F4F7FA] pb-24 font-sans"}>
      {!isEmbeddedInSheet && <Header />}

      <div className={
        isEmbeddedInSheet
          ? "px-4 py-4"
          : "container mx-auto px-4 py-12"
      }>
        {!isEmbeddedInSheet && (
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Saved Places</h1>
            <p className="text-muted-foreground text-sm">Your curated collection of adventures and stays.</p>
          </header>
        )}

        <main className={isEmbeddedInSheet ? "space-y-3" : "space-y-3"}>
          {isEmbeddedInSheet && (
            <div className="mb-2 px-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Your Saved Items
              </p>
            </div>
          )}

          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-[32px]" />
          ) : savedListings.length === 0 ? (
            <div className="bg-white rounded-[40px] p-20 text-center text-slate-400 border border-slate-100">
              No items saved yet.
            </div>
          ) : (
            <div className="grid gap-3">
              {!user && (
                <div className="mb-1 rounded-[24px] border border-primary/15 bg-primary/5 px-4 py-3 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary">Saved offline until login — open is locked</p>
                </div>
              )}

              {savedListings.map((item) => {
                const href = createDetailPath(item.savedType, item.id, item.name, item.location);

                return (
                  <div key={item.id} className="flex items-center gap-2">

                    {/* ── Delete button ──────────────────────────────────────────
                        Sits OUTSIDE the anchor so its click never triggers navigation.
                        Uses both onClick AND onTouchEnd so it fires on every platform.
                    ────────────────────────────────────────────────────────────── */}
                    <button
                      onClick={(e) => handleRemoveSingle(item.id, e)}
                      disabled={deletingId === item.id}
                      className="shrink-0 p-3 rounded-full bg-red-50 text-red-500 active:bg-red-100 active:scale-90 transition-all border border-red-100 select-none"
                      aria-label="Remove item"
                      style={{
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        zIndex: 10,
                        position: 'relative',
                      }}
                    >
                      {deletingId === item.id
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Trash2 size={16} />
                      }
                    </button>

                    {/* ── Card ───────────────────────────────────────────────────
                        Uses a REAL <a> tag (not div, not Link).

                        Why: Inside a Sheet with overflow-y-auto + touchAction:pan-y,
                        the browser claims all touch events for scroll detection.
                        Synthetic React events (onClick on div, onTouchEnd) get
                        swallowed or delayed. Native <a> elements are the ONE exception
                        — browsers ALWAYS dispatch click on <a> regardless of scroll
                        containers because it's a native interactive element.

                        href points to the detail route; React Router's history is NOT
                        used here intentionally — the browser handles navigation via the
                        href, which triggers a normal client-side route change through
                        the app's router because it's a SPA with a catch-all route.
                    ────────────────────────────────────────────────────────────── */}
                    <a
                      href={user ? href : "#"}
                      onClick={(e) => {
                        if (deletingRef.current === item.id) {
                          e.preventDefault();
                          return;
                        }

                        if (!user) {
                          e.preventDefault();
                          toast({
                            title: "Login required",
                            description: "Saved items stay offline on this device, but you need to log in before opening them.",
                          });
                        }
                      }}
                      className="flex-1 flex items-center gap-4 bg-white p-3 sm:p-4 rounded-[24px] border border-slate-100 hover:shadow-md transition-all active:scale-[0.98] min-w-0 group no-underline"
                      style={{
                        WebkitTapHighlightColor: 'transparent',
                        touchAction: 'manipulation',
                        textDecoration: 'none',
                      }}
                      draggable={false}
                      aria-disabled={!user}
                    >
                      <img
                        src={item.image_url}
                        className="h-16 w-16 rounded-xl object-cover shrink-0"
                        alt=""
                        draggable={false}
                      />

                      <div className="flex-1 min-w-0">
                         <p className="text-[9px] font-bold text-primary uppercase mb-0.5">
                          {item.savedType?.replace('_', ' ')}
                        </p>
                        <h3 className="text-sm sm:text-base font-bold text-slate-800 truncate">
                          {item.name}
                        </h3>
                        <div className="flex items-center text-slate-400 text-xs mt-0.5">
                          <MapPin size={10} className="mr-1 shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      </div>

                       <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-primary group-hover:text-primary-foreground transition-all shrink-0">
                         {!user ? <Lock size={14} /> : <ChevronRight size={16} />}
                      </div>
                    </a>

                  </div>
                );
              })}
            </div>
          )}
            {user && hasMore && savedListings.length > 0 && (
              <div className="flex justify-center mt-6">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="outline"
                  className="rounded-2xl font-bold text-xs h-10 px-6"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
        </main>
      </div>

      {!isEmbeddedInSheet && (
        <>
          <Footer />
          <MobileBottomBar />
        </>
      )}
    </div>
  );
};

export default Saved;