import React, { useState, memo, useCallback, useMemo, useEffect } from "react";
import { MapPin, Heart, Star, Calendar, Ticket } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, optimizeSupabaseImage } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { createDetailPath } from "@/lib/slugUtils";
import { useIntersectionObserver } from "@/hooks/useIntersectionObserver";

const PriceText = ({ price, isUnavailable, type }: { price: number; isUnavailable: boolean; type: string }) => {
  const { formatPrice } = useCurrency();
  const label = ['HOTEL', 'ACCOMMODATION'].includes(type) ? '/night' : '/person';
  return (
    <div className={cn(
      "flex items-center gap-1 rounded-md px-2.5 py-1 bg-destructive/10",
      isUnavailable && "opacity-50 line-through"
    )}>
      <span className="text-sm font-bold text-destructive whitespace-nowrap">{formatPrice(price)}</span>
      <span className="text-[9px] text-destructive/70 font-medium">{label}</span>
    </div>
  );
};

export interface ListingCardProps {
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
  description?: string;
  categoryColor?: string;
}

const ListingCardComponent = ({
  id, type, name, imageUrl, location, price, date,
  isOutdated = false, onSave, isSaved = false, activities,
  availableTickets = 0, bookedTickets = 0,
  priority = false, compact = false, avgRating, reviewCount, place,
  isFlexibleDate = false, hidePrice = false, description, categoryColor
}: ListingCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isSavedLocal, setIsSavedLocal] = useState(isSaved);
  const navigate = useNavigate();

  useEffect(() => { setIsSavedLocal(isSaved); }, [isSaved]);

  const { ref: imageContainerRef, isIntersecting } = useIntersectionObserver({ rootMargin: '300px', triggerOnce: true });
  const shouldLoadImage = priority || isIntersecting;

  const isEventOrSport = useMemo(() => type === "EVENT" || type === "SPORT", [type]);
  const isTrip = useMemo(() => type === "TRIP", [type]);
  const tracksAvailability = useMemo(() => isEventOrSport || isTrip, [isEventOrSport, isTrip]);

  const remainingTickets = useMemo(() => availableTickets - bookedTickets, [availableTickets, bookedTickets]);
  const isSoldOut = useMemo(() => tracksAvailability && availableTickets > 0 && remainingTickets <= 0, [tracksAvailability, availableTickets, remainingTickets]);
  const fewSlotsRemaining = useMemo(() => tracksAvailability && remainingTickets > 0 && remainingTickets <= 10, [tracksAvailability, remainingTickets]);
  const isUnavailable = useMemo(() => isOutdated || isSoldOut, [isOutdated, isSoldOut]);

  const optimizedImageUrl = useMemo(() => optimizeSupabaseImage(imageUrl, { width: 600, height: 450, quality: 85 }), [imageUrl]);
  const displayType = useMemo(() => {
    if (isEventOrSport) return "Event & Sports";
    if (type === "ADVENTURE PLACE") return "Attraction";
    if (type === "HOTEL") return "Hotel";
    if (type === "TRIP") return "Trip";
    return type.replace('_', ' ');
  }, [isEventOrSport, type]);

  const formattedName = useMemo(() => name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), [name]);
  const locationString = useMemo(() => [place, location].filter(Boolean).join(', '), [place, location]);

  // Subtitle: only activities (no description)
  const subtitle = useMemo(() => {
    if (activities && activities.length > 0) {
      const names = activities.slice(0, 3).map((a: any) => typeof a === 'string' ? a : a.name);
      return names.join(' • ');
    }
    return null;
  }, [activities]);

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

  // Urgency badge
  const urgencyBadge = useMemo(() => {
    if (isSoldOut) return { text: "Sold out", color: "bg-destructive/10 text-destructive border-destructive/20" };
    if (isOutdated) return { text: "Passed", color: "bg-muted text-muted-foreground border-border" };
    if (fewSlotsRemaining) return { text: `🔥 Only ${remainingTickets} left!`, color: "bg-orange-50 text-orange-700 border-orange-200" };
    return null;
  }, [isSoldOut, isOutdated, fewSlotsRemaining, remainingTickets]);

  return (
    <Card
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-row md:flex-col overflow-hidden cursor-pointer bg-card transition-all duration-300",
        "rounded-xl border border-border shadow-sm",
        "hover:shadow-md hover:border-primary/20",
        compact ? "h-auto" : "h-full",
        isUnavailable && "opacity-80"
      )}
    >
      {/* Image */}
      <div
        ref={imageContainerRef}
        className="relative w-[100px] sm:w-[120px] md:w-full flex-shrink-0 overflow-hidden min-h-[120px] md:aspect-[16/9] md:min-h-0"
      >
        {!imageLoaded && !imageError && (
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        )}
        {shouldLoadImage && !imageError && (
          <img
            src={optimizedImageUrl}
            alt={name}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105",
              imageLoaded ? "opacity-100" : "opacity-0",
              isUnavailable && "grayscale-[0.5]"
            )}
          />
        )}

        {/* Heart */}
        {onSave && (
          <button
            onClick={handleSaveClick}
            className={cn(
              "absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90",
              isSavedLocal ? "bg-card shadow-sm" : "bg-black/20 backdrop-blur-sm hover:bg-card/80"
            )}
          >
            <Heart className={cn("h-4 w-4 transition-colors", isSavedLocal ? "fill-rose-500 text-rose-500" : "text-white")} />
          </button>
        )}

        {/* Sold out overlay */}
        {isUnavailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
            <span className="rounded-md border border-white/60 px-3 py-0.5 text-[10px] font-black uppercase text-white">
              {isSoldOut ? 'Sold Out' : 'Unavailable'}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col justify-between p-3 sm:p-4 min-w-0 gap-1.5">
        {/* Top: Category + Urgency */}
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md",
              !categoryColor && "text-primary-foreground bg-primary"
            )}
            style={categoryColor ? { color: '#fff', backgroundColor: categoryColor } : undefined}
          >
            {displayType}
          </span>
          {urgencyBadge && (
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", urgencyBadge.color)}>
              {urgencyBadge.text}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="line-clamp-2 text-sm sm:text-[15px] font-bold leading-snug text-foreground group-hover:text-primary transition-colors">
          {formattedName}
        </h3>

        {/* Subtitle: activities only */}
        {subtitle && (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">
            {subtitle}
          </p>
        )}

        {/* Location */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <MapPin className="h-3 w-3 flex-shrink-0 text-primary/60" />
          <span className="text-[11px] font-medium truncate capitalize">{locationString.toLowerCase()}</span>
        </div>

        {/* Bottom row: Rating + Date + Slots + Price */}
        <div className="flex items-center justify-between gap-2 pt-1.5 mt-auto border-t border-border/50">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* Rating - always show if available */}
            {avgRating != null && avgRating > 0 && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <span className="text-[11px] font-bold text-foreground">{avgRating.toFixed(1)}</span>
                {reviewCount != null && reviewCount > 0 && (
                  <span className="text-[9px] text-muted-foreground">({reviewCount})</span>
                )}
              </div>
            )}

            {/* Date */}
            {(date || isFlexibleDate) && (
              <div className="flex items-center gap-0.5 text-muted-foreground flex-shrink-0">
                <Calendar className="h-2.5 w-2.5" />
                <span className="text-[10px] font-medium">
                  {isFlexibleDate ? 'Flexible' : new Date(date!).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            )}

            {/* Slots */}
            {tracksAvailability && availableTickets > 0 && !isUnavailable && !fewSlotsRemaining && (
              <span className="text-[9px] font-semibold text-primary flex-shrink-0">
                <Ticket className="inline h-2.5 w-2.5 mr-0.5" />{remainingTickets}
              </span>
            )}
          </div>

          {/* Price */}
          {!hidePrice && price != null && price > 0 && (
            <div className="flex-shrink-0">
              <PriceText price={price} isUnavailable={isUnavailable} type={type} />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

export const ListingCard = memo(React.forwardRef<HTMLDivElement, ListingCardProps>(
  (props, ref) => <ListingCardComponent {...props} />
));
ListingCard.displayName = "ListingCard";
