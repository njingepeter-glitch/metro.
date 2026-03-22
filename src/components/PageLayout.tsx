import { useLocation, useNavigate } from "react-router-dom";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Header } from "@/components/Header";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface SearchFocusContextType {
  isSearchFocused: boolean;
  setSearchFocused: (v: boolean) => void;
}

const SearchFocusContext = createContext<SearchFocusContextType>({
  isSearchFocused: false,
  setSearchFocused: () => {},
});

export const useSearchFocus = () => useContext(SearchFocusContext);

interface PageLayoutProps {
  children: React.ReactNode;
}

export const PageLayout = ({ children }: PageLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const pathname = location.pathname;
  const [isSearchFocused, setSearchFocused] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const swipeTabs = ["/", "/bookings", "/saved", user ? "/profile" : "/auth"];
  const swipeIndex = swipeTabs.indexOf(pathname);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (swipeIndex === -1) return;
    const target = event.target as HTMLElement;
    if (target.closest("input, textarea, select, button, a, [role='button']")) return;
    setTouchStartX(event.changedTouches[0]?.clientX ?? null);
  }, [swipeIndex]);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartX === null || swipeIndex === -1) return;
    const deltaX = event.changedTouches[0]?.clientX - touchStartX;
    if (Math.abs(deltaX) < 70) {
      setTouchStartX(null);
      return;
    }

    const nextIndex = deltaX < 0 ? swipeIndex + 1 : swipeIndex - 1;
    const nextPath = swipeTabs[nextIndex];
    if (nextPath) navigate(nextPath);
    setTouchStartX(null);
  }, [navigate, swipeIndex, swipeTabs, touchStartX]);

  const shouldShowFooter =
    pathname === "/" || pathname === "/contact" || pathname === "/about" || pathname.startsWith("/category/");

  const shouldHideMobileBar =
    pathname === "/host-verification";

  // Auth page renders its own header
  const isDetailPage =
    pathname.startsWith("/adventure/") || pathname.startsWith("/hotel/") ||
    pathname.startsWith("/event/") || pathname.startsWith("/trip/");

  const shouldHideHeader =
    pathname === "/auth" || pathname === "/reset-password" || pathname === "/forgot-password" ||
    pathname === "/verify-email" || pathname === "/complete-profile" || pathname.startsWith("/booking/") ||
    isDetailPage;

  // On mobile, only show header on index page
  const shouldHideHeaderOnMobile = pathname !== "/";

  // Hide header completely when search is focused
  const hideHeaderForSearch = isSearchFocused;

  return (
    <SearchFocusContext.Provider value={{ isSearchFocused, setSearchFocused }}>
      <div className="w-full min-h-screen flex flex-col" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <OfflineIndicator />
        {!shouldHideHeader && !hideHeaderForSearch && (
          <div className={shouldHideHeaderOnMobile ? "hidden md:block" : ""}>
            <Header __fromLayout />
          </div>
        )}
        {/* pt-14 on md+ for fixed header; on mobile header is not fixed so no top padding needed */}
        <div className={`flex-1 w-full pb-20 md:pb-0 ${!shouldHideHeader && !hideHeaderForSearch ? (shouldHideHeaderOnMobile ? 'pt-0 md:pt-14' : 'pt-0 md:pt-14') : ''}`}>{children}</div>
        {shouldShowFooter && <Footer />}
        {!shouldHideMobileBar && <MobileBottomBar />}
      </div>
    </SearchFocusContext.Provider>
  );
};
