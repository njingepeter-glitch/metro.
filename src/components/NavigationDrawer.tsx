import { useState, useEffect } from "react";
import { 
  Phone, Info, LogIn, LogOut, User, 
  FileText, Shield, ChevronRight, Building2, Globe, Languages, Coins
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Button } from "@/components/ui/button";

interface NavigationDrawerProps {
  onClose: () => void;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "sw", name: "Kiswahili" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Español" },
  { code: "pt", name: "Português" },
  { code: "de", name: "Deutsch" },
  { code: "zh", name: "中文" },
  { code: "ar", name: "العربية" },
  { code: "he", name: "עברית" },
];

export const NavigationDrawer = ({ onClose }: NavigationDrawerProps) => {
  const { user, signOut } = useAuth();
  const { t, i18n } = useTranslation();
  const { currency, setCurrency } = useCurrency();
  const [userName, setUserName] = useState("");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [language, setLanguage] = useState(i18n.language || "en");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("name, profile_picture_url").eq("id", user.id).single();
      if (profile) {
        setUserName(profile.name || "");
        setUserAvatar(profile.profile_picture_url || null);
      }
    };
    fetchUserData();
  }, [user]);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    document.documentElement.dir = (lang === "ar" || lang === "he") ? "rtl" : "ltr";
    setShowLangPicker(false);
  };

  const NavItem = ({ icon: Icon, label, path, onClick }: { icon: any; label: string; path?: string; onClick?: () => void }) => (
    <button
      onClick={() => {
        if (onClick) { onClick(); return; }
        if (path) window.location.href = path;
        onClose();
      }}
      className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/50 transition-all active:scale-[0.98] group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-muted group-hover:bg-primary transition-colors">
          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary-foreground" />
        </div>
        <span className="text-sm font-medium text-foreground">{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
    </button>
  );

  const currentLangName = LANGUAGES.find(l => l.code === language)?.name || "English";

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-border flex items-center justify-between flex-shrink-0">
        <Link to="/" onClick={onClose} className="flex items-center gap-2">
          <img src="/fulllogo.png" alt="Realtravo" className="h-7" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-6">
        {/* User Section */}
        <div className="p-4">
          {user ? (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-muted/50 border border-border">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{userName || "Traveler"}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          ) : (
            <Link
              to="/auth" onClick={onClose}
              className="flex items-center justify-center w-full py-3 rounded-xl bg-primary text-primary-foreground hover:brightness-110 transition-all"
            >
              <LogIn className="h-4 w-4 mr-2" />
              <span className="text-sm font-semibold">{t('nav.loginRegister')}</span>
            </Link>
          )}
        </div>

        {/* Companies */}
        <div className="px-2">
          <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Companies</p>
          <div className="rounded-xl overflow-hidden border border-border mx-2">
            <NavItem icon={Building2} label="Browse Companies" path="/company" />
          </div>
        </div>

        {/* Support & Legal */}
        <div className="px-2 mt-4">
          <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('drawer.supportLegal')}</p>
          <div className="rounded-xl overflow-hidden border border-border mx-2 divide-y divide-border">
            <NavItem icon={Phone} label={t('drawer.contact')} path="/contact" />
            <NavItem icon={Info} label={t('drawer.about')} path="/about" />
            <NavItem icon={FileText} label={t('drawer.terms')} path="/terms-of-service" />
            <NavItem icon={Shield} label={t('drawer.privacy')} path="/privacy-policy" />
          </div>
        </div>

        {/* Preferences */}
        <div className="px-2 mt-4">
          <p className="px-4 pt-2 pb-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Preferences</p>
          <div className="rounded-xl overflow-hidden border border-border mx-2 divide-y divide-border">
            <NavItem icon={Languages} label={`Language: ${currentLangName}`} onClick={() => setShowLangPicker(!showLangPicker)} />
            {showLangPicker && (
              <div className="p-3 bg-muted/30 grid grid-cols-2 gap-1.5">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => handleLanguageChange(l.code)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      language === l.code 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-background text-foreground hover:bg-muted border border-border"
                    }`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            )}
            <NavItem icon={Coins} label={`Currency: ${currency}`} onClick={() => setShowCurrencyPicker(!showCurrencyPicker)} />
            {showCurrencyPicker && (
              <div className="p-3 bg-muted/30 flex gap-2">
                {["KES", "USD"].map((cur) => (
                  <button
                    key={cur}
                    onClick={() => { setCurrency(cur as any); setShowCurrencyPicker(false); }}
                    className={`flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      currency === cur 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-background text-foreground hover:bg-muted border border-border"
                    }`}
                  >
                    {cur === "KES" ? "KSh (KES)" : "$ (USD)"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Logout */}
        {user && (
          <div className="px-4 mt-4 mb-4">
            <button 
              onClick={() => { signOut(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/20 text-destructive hover:bg-destructive/5 transition-all active:scale-[0.98]"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-semibold">Log Out</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
