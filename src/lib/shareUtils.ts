import { createDetailPath } from "@/lib/slugUtils";

/**
 * Generate a clean, SEO-friendly share link for an item.
 * No referral parameters — just slug-based URLs.
 */
export const getShareLink = (
  itemId: string,
  itemType: string,
  itemName: string,
  itemLocation?: string
): string => {
  const typeMap: Record<string, string> = {
    trip: "trip",
    event: "event",
    hotel: "hotel",
    adventure: "adventure",
    adventure_place: "adventure",
  };
  const type = typeMap[itemType] || itemType;
  const path = createDetailPath(type, itemId, itemName, itemLocation);
  return `${window.location.origin}${path}`;
};
