import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Menu, Heart, Ticket, Home, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { NavigationDrawer } from "./NavigationDrawer";
import { Link, useNavigate } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { AccountSheet } from "./AccountSheet";

export interface HeaderProps {
  onSearchClick?: () => void;
  showSearchIcon?: boolean;
  className?: string;
  hideIcons?: boolean;
  __fromLayout?: boolean;
}

const LogoWithFallback = () => {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="h-8 w-8 rounded-full shadow-sm border border-border bg-muted flex items-center justify-center overflow-hidden relative">
      {!loaded && (
        <span className="font-bold text-lg italic leading-none" style={{ background: "linear-gradient(to right, #1a365d, #2b6cb0, #4fd1c5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>R</span>
      )}
      <img 
        src="/fulllogo.png" 
        alt="Logo" 
        loading="eager" 
        fetchPriority="high" 
        className={`h-full w-full object-contain p-1 absolute inset-0 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
};

export const Header = ({ onSearchClick, showSearchIcon = true, className, __fromLayout }: HeaderProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user) return;
      const { error } = await supabase.from('profiles').select('name').eq('id', user.id).maybeSingle();
      if (error) console.error("Error fetching profile:", error.message);
    };
    fetchUserProfile();
  }, [user]);

  // Skip rendering if this is a page-level Header (PageLayout already renders one)
  if (!__fromLayout) return null;

  const mobileHeaderClasses = "absolute top-0 md:fixed md:top-0 left-0 right-0 flex bg-transparent md:bg-background md:border-b md:border-border md:shadow-sm py-3";
  const headerIconStyles = "h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 text-white md:text-foreground hover:bg-white/20 md:hover:bg-muted";

  return (
    <header className={`z-[100] items-center ${mobileHeaderClasses} ${className || ''}`}>
      <div className="container mx-auto px-4 flex items-center justify-between h-full">
        <div className="flex items-center gap-2">
          <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
            <SheetTrigger asChild>
              <button className={headerIconStyles} aria-label="Open Menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 h-screen border-none">
              <NavigationDrawer onClose={() => setIsDrawerOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link to="/" className="flex items-center gap-2 group ml-1">
            <LogoWithFallback />
            <span className="font-bold text-lg tracking-tight italic leading-none text-white md:text-transparent md:bg-clip-text" style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: undefined, background: undefined } as any}>
              <span className="md:hidden text-white font-bold text-lg tracking-tight italic">RealTravo</span>
              <span className="hidden md:inline font-bold text-lg tracking-tight italic" style={{ background: "linear-gradient(to right, #1a365d, #2b6cb0, #4fd1c5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>RealTravo</span>
            </span>
          </Link>
        </div>
        <nav className="hidden lg:flex items-center gap-8">
          {[{ to: "/", icon: <Home className="h-4 w-4" />, label: t('nav.home') }, { to: "/bookings", icon: <Ticket className="h-4 w-4" />, label: t('nav.bookings') }, { to: "/saved", icon: <Heart className="h-4 w-4" />, label: t('nav.wishlist') }].map(item => (
            <Link key={item.to} to={item.to} className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors">
              {item.icon}<span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="[&_button]:text-white md:[&_button]:text-foreground">
            <NotificationBell />
          </div>
          {user ? (
            <AccountSheet>
              <button className="hidden sm:flex h-10 px-4 rounded-xl items-center gap-2 transition-all font-semibold text-xs text-primary-foreground bg-primary hover:brightness-110">
                <User className="h-4 w-4" /><span>{t('nav.profile')}</span>
              </button>
            </AccountSheet>
          ) : (
            <button onClick={() => navigate('/auth')} className="hidden sm:flex h-10 px-4 rounded-xl items-center gap-2 transition-all font-semibold text-xs text-primary-foreground bg-primary hover:brightness-110">
              <User className="h-4 w-4" /><span>{t('nav.login')}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};