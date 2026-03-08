import React, { useState, memo, useCallback, useMemo, useEffect } from "react";
import { MapPin, Heart, Star, Calendar, Ticket } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

interface ListingCardProps {
  id: string;
  type: 'TRIP' | 'EVENT' | 'SPORT' | 'HOTEL' | 'ADVENTURE PLACE' | 'ACCOMMODATION' | 'ATTRACTION';
  name: string;
  imageUrl: string;
  location: string;
  country: string;
  price?: number;
  date?: string;
  isCustomDate?: boolean;
  isFlexibleDate?: boolean;
  isOutdated?: boolean;
  onSave?: (id: string, type: string) => void;
  isSaved?: boolean;
  amenities?: string[];
  activities?: any[];
  hidePrice?: boolean;
  availableTickets?: number;
  bookedTickets?: number;
  showBadge?: boolean;
  priority?: boolean;
  minimalDisplay?: boolean;
  hideEmptySpace?: boolean;
  compact?: boolean;
  distance?: number;
  avgRating?: number;
  reviewCount?: number;
  place?: string;
  showFlexibleDate?: boolean;
}

const ListingCardComponent = ({
  id, type, name, imageUrl, location, price, date,
  isOutdated = false, onSave, isSaved = false, activities, 
  availableTickets = 0, bookedTickets = 0, 
  priority = false, compact = false, avgRating, place,
  isFlexibleDate = false, hidePrice = false
}: ListingCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isSavedLocal, setIsSavedLocal] = useState(isSaved);
  const navigate = useNavigate();

  useEffect(() => {
    setIsSavedLocal(isSaved);
  }, [isSaved]);

  const { ref: imageContainerRef, isIntersecting } = useIntersectionObserver({
    rootMargin: '300px',
    triggerOnce: true
  });

  const shouldLoadImage = priority || isIntersecting;
  const isEventOrSport = useMemo(() => type === "EVENT" || type === "SPORT", [type]);
  const isTrip = useMemo(() => type === "TRIP", [type]);
  const tracksAvailability = useMemo(() => isEventOrSport || isTrip, [isEventOrSport, isTrip]);
  
  const remainingTickets = useMemo(() => availableTickets - bookedTickets, [availableTickets, bookedTickets]);
  const isSoldOut = useMemo(() => tracksAvailability && availableTickets > 0 && remainingTickets <= 0, [tracksAvailability, availableTickets, remainingTickets]);
  const fewSlotsRemaining = useMemo(() => tracksAvailability && remainingTickets > 0 && remainingTickets <= 10, [tracksAvailability, remainingTickets]);
  const isUnavailable = useMemo(() => isOutdated || isSoldOut, [isOutdated, isSoldOut]);

  const optimizedImageUrl = useMemo(() => optimizeSupabaseImage(imageUrl, { width: 600, height: 450, quality: 85 }), [imageUrl]);
  const displayType = useMemo(() => isEventOrSport ? "Event & Sports" : type.replace('_', ' '), [isEventOrSport, type]);
  
  const formattedName = useMemo(() => {
    return name.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
  }, [name]);
  
  const locationString = useMemo(() => [place, location].filter(Boolean).join(', '), [place, location]);

  const handleCardClick = useCallback(() => {
    const typeMap: Record<string, string> = {
      "TRIP": "trip", "EVENT": "event", "SPORT": "event", "HOTEL": "hotel",
      "ADVENTURE PLACE": "adventure", "ACCOMMODATION": "accommodation", "ATTRACTION": "attraction"
    };
    navigate(createDetailPath(typeMap[type], id, name, location));
  }, [navigate, type, id, name, location]);

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsSavedLocal(!isSavedLocal);
    onSave?.(id, type);
  };

  return (
    <Card 
      onClick={handleCardClick} 
      className={cn(
        // Core Layout & Background
        "group relative flex flex-col overflow-hidden cursor-pointer bg-white transition-all duration-500",
        "rounded-[32px] border border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)]",
        
        // Hover States: Movement, Deeper Shadow, and Border Color Shift
        "hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(0,0,0,0.12)] hover:border-teal-100",
        
        compact ? "h-auto" : "h-full",
        isUnavailable && "opacity-90"
      )}
    >
      {/* Image Container */}
      <div 
        ref={imageContainerRef} 
        className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100"
      >
        {!imageLoaded && !imageError && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        )}
        
        {shouldLoadImage && !imageError && (
          <img 
            src={optimizedImageUrl} 
            alt={name}
            onLoad={() => setImageLoaded(true)}
            className={cn(
                "absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110", 
                imageLoaded ? "opacity-100" : "opacity-0",
                isUnavailable && "grayscale-[0.5]"
            )} 
          />
        )}

        {/* Floating Category & Rating */}
        <div className="absolute left-4 top-4 z-20 flex flex-col gap-2">
          <Badge className="w-fit border-none bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-900 backdrop-blur-md shadow-sm">
            {displayType}
          </Badge>
          {avgRating && (
            <div className="flex w-fit items-center gap-1 rounded-full bg-black/40 px-2 py-0.5 text-white backdrop-blur-md">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span className="text-[11px] font-bold">{avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>

        {/* Heart Save Button */}
        {onSave && (
          <button 
            onClick={handleSaveClick}
            className={cn(
                "absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full transition-all active:scale-90 shadow-xl", 
                isSavedLocal ? "bg-white" : "bg-white/20 backdrop-blur-xl border border-white/30 hover:bg-white"
            )}
          >
            <Heart className={cn("h-5 w-5 transition-colors", isSavedLocal ? "fill-rose-500 text-rose-500" : "text-white group-hover:text-slate-900")} />
          </button>
        )}

        {/* Status Overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <span className="rotate-[-10deg] rounded-lg border-2 border-white/80 px-4 py-1 text-xs font-black uppercase text-white shadow-2xl">
               {isSoldOut ? 'Sold Out' : 'Unavailable'}
            </span>
          </div>
        )}
      </div>
      
      {/* Content Section */}
      <div className="flex flex-1 flex-col p-6"> 
        <h3 className="line-clamp-2 text-lg font-bold leading-tight tracking-tight text-slate-800 transition-colors group-hover:text-teal-600">
          {formattedName}
        </h3>
        
        <div className="mt-2 flex items-center gap-1.5 text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-teal-500/70" />
            <p className="text-xs font-medium truncate capitalize">
                {locationString.toLowerCase()}
            </p>
        </div>

        {/* Tags */}
        {activities && activities.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {activities.slice(0, 2).map((act, i) => (
              <span key={i} className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                #{typeof act === 'string' ? act : act.name}
              </span>
            ))}
          </div>
        )}
        
        {/* Footer Info */}
        <div className="mt-auto flex items-end justify-between border-t border-slate-100 pt-5">
            <div className="flex flex-col">
                {!hidePrice && price != null && (
                  <>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {['HOTEL', 'ACCOMMODATION'].includes(type) ? 'Per Night' : 'From'}
                    </span>
                        <PriceText price={price} isUnavailable={isUnavailable} />
                  </>
                )}
            </div>

            <div className="flex flex-col items-end gap-2">
                {/* Date Badge */}
                {(date || isFlexibleDate) && (
                  <div className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1 border shadow-sm",
                    isFlexibleDate ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-slate-50 border-slate-100 text-slate-600"
                  )}>
                      <Calendar className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase">
                          {isFlexibleDate ? 'Flexible' : new Date(date!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                  </div>
                )}
                
                {/* Availability Labels */}
                <div className="h-4 flex items-center">
                  {isOutdated ? (
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Passed</span>
                  ) : isSoldOut ? (
                    <span className="text-[10px] font-bold text-rose-500 uppercase">Sold Out</span>
                  ) : fewSlotsRemaining ? (
                    <span className="flex items-center gap-1 text-[10px] font-black text-orange-600 uppercase animate-pulse">
                        <Ticket className="h-3 w-3" /> {remainingTickets} left!
                    </span>
                  ) : (tracksAvailability && availableTickets > 0) && (
                    <span className="text-[10px] font-bold text-teal-600 uppercase">
                        {remainingTickets} Spots
                    </span>
                  )}
                </div>
            </div>
        </div>
      </div>

      {/* Hover Progress Bar */}
      <div className="absolute bottom-0 h-1.5 w-0 bg-teal-500 transition-all duration-700 group-hover:w-full" />
    </Card>
  );
};

export const ListingCard = memo(React.forwardRef<HTMLDivElement, ListingCardProps>(
  (props, ref) => <ListingCardComponent {...props} />
));
ListingCard.displayName = "ListingCard";