/**
 * Generates a URL-friendly slug from name and location
 */
export const generateSlug = (name: string, location?: string): string => {
  const combined = location ? `${name}-${location}` : name;
  return combined
    .toLowerCase()
    .trim()
    .replace(/[^\\w\\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
    .substring(0, 100); // Limit length
};

/**
 * Parses a slug to extract potential search terms
 */
export const parseSlug = (slug: string): string => {
  return slug.replace(/-/g, ' ').trim();
};

/**
 * Creates a full URL path with slug and id for fallback
 * Uses full UUID for reliable database lookups
 */
export const createDetailPath = (
  type: string,
  id: string,
  name: string,
  location?: string
): string => {
  // If name is empty or invalid, just use the ID directly
  if (!name || name.trim() === '') {
    return `/${type}/${id}`;
  }
  
  const slug = generateSlug(name, location);
  
  // If slug generation failed, use ID directly
  if (!slug) {
    return `/${type}/${id}`;
  }
  
  // Use full UUID for reliable matching
  return `/${type}/${slug}-${id}`;
};

/**
 * Extracts ID from a slug-id combination or returns the ID directly
 * Prioritizes full UUID format for database queries
 * Also handles short text IDs (e.g., "ss-fk-OHZC", "tt-TIQJ")
 */
export const extractIdFromSlug = (slugWithId: string): string => {
  if (!slugWithId) return '';
  
  // Check for full UUID pattern anywhere in the string
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const uuidMatch = slugWithId.match(uuidPattern);
  if (uuidMatch) {
    return uuidMatch[0];
  }
  
  // For short IDs like "ss-fk-OHZC" embedded in slugs like "ss-fk-jd-ss-fk-OHZC",
  // try to extract by finding a pattern with uppercase chars at the end (common for short IDs)
  const shortIdPattern = /([a-z]+-[a-z]+-[A-Za-z0-9]+)$/;
  const shortMatch = slugWithId.match(shortIdPattern);
  if (shortMatch) {
    return shortMatch[1];
  }
  
  // Return original string for backward compatibility with direct ID access
  return slugWithId;
};
