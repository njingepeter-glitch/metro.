import { useEffect, useState, useMemo, useRef } from "react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarClock, ChevronDown, ChevronUp, Loader2, Lock, WifiOff } from "lucide-react";
import { RescheduleBookingDialog } from "@/components/booking/RescheduleBookingDialog";
import { BookingDownloadButton } from "@/components/booking/BookingDownloadButton";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { useOfflineBookings } from "@/hooks/useOfflineBookings";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { BookingsSkeleton } from "@/components/BookingsSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

const bookingsCache = { data: null as any[] | null, timestamp: 0 };

const Bookings = () => {
  const { formatPrice } = useCurrency();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { cachedBookings, cacheBookings } = useOfflineBookings();
  const isEmbeddedInSheet = location.pathname !== "/bookings";
  
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleBooking, setRescheduleBooking] = useState<any | null>(null);
  
  const [expandedBookings, setExpandedBookings] = useState<Record<string, boolean>>({});
  
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 10;
  const hasFetched = useRef(false);

  useEffect(() => {
    if (authLoading) return;

    if (user && isOnline) {
      if (bookingsCache.data && !hasFetched.current) {
        setBookings(bookingsCache.data);
        setLoading(false);
        hasFetched.current = true;
      } else {
        fetchBookings();
      }
    } else if (user && !isOnline) {
      setBookings(cachedBookings);
      setLoading(false);
    } else if (!user) {
      setBookings(cachedBookings);
      setLoading(false);
    }
  }, [user, isOnline, authLoading, cachedBookings]);

  const fetchBookings = async (fetchOffset: number = 0) => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("user_id", user?.id)
        .in("payment_status", ["paid", "completed"])
        .not("status", "eq", "cancelled")
        .order("created_at", { ascending: false })
        .range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1);
      
      if (error) throw error;
        if (fetchOffset === 0) {
          setBookings(data || []);
          bookingsCache.data = data;
          cacheBookings(data || []);
        } else {
          setBookings(prev => {
            const nextBookings = [...prev, ...(data || [])];
            cacheBookings(nextBookings);
            return nextBookings;
          });
        }
      setHasMore((data || []).length >= ITEMS_PER_PAGE);
    } catch (e) { 
      console.error("Fetch error:", e); 
    } finally { 
      setLoading(false); 
      setLoadingMore(false); 
    }
  };

  const loadMore = () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextOffset = offset + ITEMS_PER_PAGE;
    setOffset(nextOffset);
    fetchBookings(nextOffset);
  };

  // FIX: Toggle function using functional update to avoid stale closures
  const toggleBooking = (id: string) => {
    setExpandedBookings(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const groupedBookings = useMemo(() => {
    const groups: Record<string, any[]> = { Today: [], Yesterday: [], Earlier: [] };
    bookings.forEach(b => {
      const d = parseISO(b.created_at);
      if (isToday(d)) groups.Today.push(b);
      else if (isYesterday(d)) groups.Yesterday.push(b);
      else groups.Earlier.push(b);
    });
    return groups;
  }, [bookings]);

  if (authLoading || loading) {
    return (
      <div className="relative flex min-h-full flex-col bg-background">
        <main className={isEmbeddedInSheet ? "flex-1 px-4 pt-4 pb-20" : "flex-1 container mx-auto px-4 pt-8 pb-32"}>
          <div className="w-full">
            <header className="mb-8">
              <Skeleton className="h-7 w-40 mb-2" />
              <Skeleton className="h-3 w-48" />
            </header>
            <BookingsSkeleton />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-full flex-col bg-background">
      <main className={isEmbeddedInSheet ? "flex-1 px-4 pt-4 pb-20" : "flex-1 container mx-auto px-4 pt-8 pb-32"}>
        <div className="w-full">{/* Full container width */}
          
          <header className="mb-8">
            <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground">My Bookings</h1>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verified Reservations</p>
            </div>
          </header>

          {!isOnline && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2">
              <WifiOff size={14} className="text-amber-600" />
              <p className="text-[10px] font-black uppercase text-amber-700">Offline: Showing cached data</p>
            </div>
          )}

          {!user && bookings.length > 0 && (
            <div className="mb-6 p-3 bg-primary/5 border border-primary/15 rounded-2xl flex items-center gap-2">
              <Lock size={14} className="text-primary" />
              <p className="text-[10px] font-black uppercase text-primary">Offline bookings saved on this device</p>
            </div>
          )}

          {bookings.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-[10px] font-black uppercase text-muted-foreground">No bookings found</p>
            </div>
          ) : (
            <div className="space-y-10">
              {Object.entries(groupedBookings).map(([groupName, groupItems]) => groupItems.length > 0 && (
                <section key={groupName} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{groupName}</span>
                    <div className="h-px bg-border flex-1" />
                  </div>

                  <div className="space-y-3">
                    {groupItems.map((b) => (
                      <div
                        key={b.id}
                        className="bg-card rounded-[24px] border border-border overflow-hidden"
                      >
                        {/* 
                          FIX: Replaced CollapsibleTrigger asChild + button with a plain div using onPointerDown.
                          On mobile, Radix CollapsibleTrigger with asChild + nested interactive elements
                          causes pointer capture conflicts. Using onPointerDown on a div is more reliable
                          for touch devices and avoids the button-inside-button accessibility issue.
                        */}
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={!!expandedBookings[b.id]}
                          onPointerDown={() => toggleBooking(b.id)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleBooking(b.id)}
                          className="w-full text-left p-4 flex items-center justify-between cursor-pointer select-none active:bg-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex gap-2 mb-1.5">
                              <Badge variant="secondary" className="text-[8px] font-black uppercase h-4 px-1.5">
                                {b.booking_type}
                              </Badge>
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-none text-[8px] font-black uppercase h-4 px-1.5">
                                Paid
                              </Badge>
                            </div>
                            <p className="text-sm font-bold text-foreground truncate pr-4">
                              {b.booking_details?.item_name || b.booking_details?.trip_name || b.booking_details?.hotel_name || b.booking_details?.place_name || 'Reservation'}
                            </p>
                            <p className="text-[9px] font-mono text-muted-foreground mt-1 uppercase">ID: {b.id.slice(0, 8)}</p>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-foreground">{formatPrice(b.total_amount)}</p>
                            <div className="flex justify-end mt-1 text-muted-foreground">
                              {expandedBookings[b.id] ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            </div>
                          </div>
                        </div>

                        {/* 
                          FIX: Replaced CollapsibleContent with a simple conditional render.
                          This removes the Radix dependency entirely for this section,
                          preventing any pointer event capture that blocked child buttons on mobile.
                        */}
                        {expandedBookings[b.id] && (
                          <div className="border-t border-border/50 bg-muted/20 p-4 space-y-5">
                            {/* Basic info */}
                            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase">
                              <div>
                                <p className="text-muted-foreground mb-1 tracking-widest">Guest</p>
                                <p className="text-foreground">{b.guest_name || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1 tracking-widest">Visit Date</p>
                                <p className="text-foreground">
                                  {b.visit_date ? format(new Date(b.visit_date), 'dd MMM yyyy') : 'N/A'}
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1 tracking-widest">Adults</p>
                                <p className="text-foreground">{b.booking_details?.adults || b.booking_details?.num_adults || 0}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1 tracking-widest">Children</p>
                                <p className="text-foreground">{b.booking_details?.children || b.booking_details?.num_children || 0}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1 tracking-widest">Slots</p>
                                <p className="text-foreground">{b.slots_booked || 1}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground mb-1 tracking-widest">Status</p>
                                <p className="text-emerald-600">Confirmed</p>
                              </div>
                            </div>

                            {/* Activities */}
                            {(() => {
                              const activities = b.booking_details?.selectedActivities || b.booking_details?.activities || [];
                              return activities.length > 0 ? (
                                <div className="bg-accent/5 rounded-2xl p-3 space-y-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-accent">Activities</p>
                                  {activities.map((a: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center text-xs">
                                      <span className="font-semibold text-foreground">{a.name || a}</span>
                                      <span className="text-muted-foreground text-[10px]">
                                        {a.numberOfPeople ? `${a.numberOfPeople} ${a.numberOfPeople === 1 ? 'person' : 'people'}` : ''}
                                        {a.price ? ` · KES ${Number(a.price).toLocaleString()}` : ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null;
                            })()}

                            {/* Facilities */}
                            {(() => {
                              const facilities = b.booking_details?.selectedFacilities || b.booking_details?.facilities || [];
                              return facilities.length > 0 ? (
                                <div className="bg-primary/5 rounded-2xl p-3 space-y-2">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Facilities</p>
                                  {facilities.map((f: any, i: number) => (
                                    <div key={i} className="text-xs space-y-0.5">
                                      <div className="flex justify-between items-center">
                                        <span className="font-semibold text-foreground">{f.name || f}</span>
                                        {f.price && <span className="text-muted-foreground text-[10px]">KES {Number(f.price).toLocaleString()}/day</span>}
                                      </div>
                                      {f.startDate && f.endDate && (
                                        <p className="text-[10px] text-muted-foreground">
                                          {format(new Date(f.startDate), 'dd MMM')} → {format(new Date(f.endDate), 'dd MMM yyyy')}
                                          {' · '}
                                          {Math.ceil((new Date(f.endDate).getTime() - new Date(f.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : null;
                            })()}

                            <div className="flex flex-wrap gap-2 pt-2">
                              {/* 
                                FIX: Wrap BookingDownloadButton in a container that stops propagation
                                at the pointer level so taps don't bubble up to the toggle handler.
                                Also added touch-manipulation for faster mobile response.
                              */}
                              <div
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => e.stopPropagation()}
                                className="touch-manipulation"
                                style={{ touchAction: 'manipulation' }}
                              >
                                <BookingDownloadButton booking={{
                                  bookingId: b.id,
                                  guestName: b.guest_name || 'Guest',
                                  guestEmail: b.guest_email || '',
                                  guestPhone: b.guest_phone,
                                  itemName: b.booking_details?.item_name || b.booking_details?.trip_name || b.booking_details?.hotel_name || b.booking_details?.place_name || 'Booking',
                                  bookingType: b.booking_type || 'booking',
                                  visitDate: b.visit_date || b.created_at,
                                  totalAmount: b.total_amount || 0,
                                  adults: b.booking_details?.adults || b.booking_details?.num_adults,
                                  children: b.booking_details?.children || b.booking_details?.num_children,
                                  slotsBooked: b.slots_booked,
                                  paymentStatus: b.payment_status || 'completed',
                                  facilities: b.booking_details?.facilities || b.booking_details?.selectedFacilities,
                                  activities: b.booking_details?.activities || b.booking_details?.selectedActivities,
                                }} />
                              </div>
                              
                              {user && b.booking_type !== 'event' && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onPointerDown={(e) => {
                                    // FIX: Use onPointerDown + stopPropagation for reliable mobile touch
                                    e.stopPropagation();
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRescheduleBooking(b); 
                                  }}
                                  className="h-9 rounded-xl text-[9px] font-black uppercase border-2 touch-manipulation"
                                  style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                                >
                                  <CalendarClock size={14} className="mr-2" /> Reschedule
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {hasMore && bookings.length > 0 && (
            <div className="mt-12 mb-8 flex justify-center">
              <Button 
                onClick={loadMore} 
                disabled={loadingMore}
                variant="ghost" 
                className="text-[10px] font-black uppercase tracking-widest underline decoration-2 underline-offset-4"
              >
                {loadingMore ? "Loading..." : "Older Bookings"}
              </Button>
            </div>
          )}
        </div>
      </main>

      {rescheduleBooking && (
        <RescheduleBookingDialog 
          booking={rescheduleBooking} 
          open={!!rescheduleBooking} 
          onOpenChange={(o) => !o && setRescheduleBooking(null)} 
          onSuccess={fetchBookings} 
        />
      )}
    </div>
  );
};

export default Bookings;