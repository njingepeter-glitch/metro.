import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Plane, Building, Tent, Plus, ArrowLeft, LayoutDashboard, Building2 } from "lucide-react";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const BecomeHost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [myContent, setMyContent] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCompany, setIsCompany] = useState(false);
  const [hostType, setHostType] = useState<"individual" | "company" | null>(null);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        // Check profile completion
        const { data: profileData } = await supabase.from('profiles').select('profile_completed').eq('id', user.id).single();
        if (cancelled) return;
        if (profileData && !profileData.profile_completed) {
          navigate('/complete-profile');
          return;
        }

        // Check if user is a company
        const { data: companyData } = await supabase
          .from("companies")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (cancelled) return;

        let localIsCompany = false;

        if (companyData) {
          if (companyData.verification_status === "pending") {
            navigate("/verification-status");
            return;
          }
          if (companyData.verification_status === "rejected") {
            navigate("/company-registration");
            return;
          }
          if (companyData.verification_status === "approved") {
            localIsCompany = true;
            setIsCompany(true);
            setHostType("company");
          }
        }

        // If not a company, check individual host verification
        if (!companyData || companyData.verification_status !== "approved") {
          const urlParams = new URLSearchParams(window.location.search);
          const refId = urlParams.get("ref");
          if (refId) trackHostReferral(refId);

          const { data: verification, error: verificationError } = await supabase
            .from("host_verifications")
            .select("*")
            .eq("user_id", user.id)
            .single();

          if (cancelled) return;

          if (verificationError && verificationError.code !== 'PGRST116') {
            setLoading(false);
            return;
          }

          if (!verification && !companyData) {
            setLoading(false);
            return;
          }
          if (verification) {
            if (verification.status === "pending") { navigate("/verification-status"); return; }
            if (verification.status === "rejected") { navigate("/host-verification"); return; }
            if (verification.status === "approved") setHostType("individual");
          }
        }

        // Fetch content using local variable instead of stale state
        const [trips, hotels, adventures] = await Promise.all([
          supabase.from("trips").select("id,name,type").eq("created_by", user.id),
          localIsCompany ? Promise.resolve({ data: [] }) : supabase.from("hotels").select("id,name").eq("created_by", user.id),
          localIsCompany ? Promise.resolve({ data: [] }) : supabase.from("adventure_places").select("id,name").eq("created_by", user.id)
        ]);

        if (cancelled) return;

        const allContent = [
          ...(trips.data?.map(t => ({ ...t, type: "trip" })) || []),
          ...(hotels.data?.map(h => ({ ...h, type: "hotel" })) || []),
          ...(adventures.data?.map(a => ({ ...a, type: "adventure" })) || [])
        ];
        setMyContent(allContent);
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    init();

    return () => { cancelled = true; };
  }, [user, navigate]);

  const trackHostReferral = async (referrerId: string) => {
    try {
      const { data: existingTracking } = await supabase
        .from("referral_tracking")
        .select("*")
        .eq("referrer_id", referrerId)
        .eq("referred_user_id", user?.id)
        .eq("referral_type", "host")
        .single();
        
      if (!existingTracking) {
        await supabase.from("referral_tracking").insert({
          referrer_id: referrerId,
          referred_user_id: user?.id,
          referral_type: "host",
          item_id: "host_referral",
          item_type: "host",
          status: "pending"
        });
        await supabase.from("profiles").update({ referrer_id: referrerId }).eq("id", user?.id);
      }
    } catch (error) {
      console.error(error);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  // Host type selection screen
  if (!hostType) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-12 mx-auto mb-24 md:mb-12">
          <div className="flex items-center gap-3 mb-8">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border border-slate-100">
              <ArrowLeft className="h-5 w-5 text-slate-600" />
            </Button>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900">
              Become a <span style={{ color: COLORS.CORAL }}>Host</span>
            </h1>
          </div>
          <p className="text-slate-500 mb-8">Choose how you'd like to host on our platform</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
            {/* Individual Host */}
            <button
              onClick={() => navigate("/host-verification")}
              className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 text-left hover:shadow-lg transition-all active:scale-[0.98] group"
            >
              <div className="p-4 rounded-2xl bg-[#008080]/10 w-fit mb-4 group-hover:bg-[#008080]/20 transition-colors">
                <Plane className="h-8 w-8 text-[#008080]" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">Individual Host</h2>
              <p className="text-sm text-slate-500">
                Host trips, events, hotels, and adventure places as an individual. Requires identity verification.
              </p>
              <Badge className="mt-4 bg-[#008080]/10 text-[#008080] border-none text-[10px] font-black uppercase">
                All listing types
              </Badge>
            </button>

            {/* Company Host */}
            <button
              onClick={() => navigate("/company-registration")}
              className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 text-left hover:shadow-lg transition-all active:scale-[0.98] group"
            >
              <div className="p-4 rounded-2xl bg-[#FF7F50]/10 w-fit mb-4 group-hover:bg-[#FF7F50]/20 transition-colors">
                <Building2 className="h-8 w-8 text-[#FF7F50]" />
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-slate-900 mb-2">Tour & Travel Company</h2>
              <p className="text-sm text-slate-500">
                Register your company to host trips, tours, and events. Auto-approved listings, no admin review needed.
              </p>
              <Badge className="mt-4 bg-[#FF7F50]/10 text-[#FF7F50] border-none text-[10px] font-black uppercase">
                Trips & Events only • Auto-approved
              </Badge>
            </button>
          </div>
        </main>
        <Footer />
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      
      <main className="flex-1 container px-4 py-12 mx-auto mb-24 md:mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="space-y-2">
            <div className="flex items-center gap-3 mb-4">
               <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full bg-white shadow-sm border border-slate-100 hover:bg-slate-50">
                <ArrowLeft className="h-5 w-5 text-slate-600" />
              </Button>
              <Badge className="bg-[#008080] hover:bg-[#008080] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                {isCompany ? "Company Dashboard" : "Host Dashboard"}
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter leading-none text-slate-900">
              Manage Your <span style={{ color: COLORS.CORAL }}>Inventory</span>
            </h1>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">
              {isCompany ? "Trips & events are auto-approved" : "Create and monitor your listings"}
            </p>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-4 rounded-[24px] shadow-sm border border-slate-100">
             <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-[#F0E68C]/20">
                <LayoutDashboard className="h-5 w-5 text-[#857F3E]" />
             </div>
             <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Total Assets</p>
                <p className="text-xl font-black text-slate-800">{myContent.length}</p>
             </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 ${isCompany ? 'md:grid-cols-1 max-w-lg' : 'md:grid-cols-3'} gap-8`}>
          {/* TOURS CARD - Always shown */}
          <HostCategoryCard 
            title="Tours & Events"
            subtitle="Trips, Sports & Events"
            image="/images/category-trips.webp"
            icon={<Plane className="h-8 w-8" />}
            count={myContent.filter(i => i.type === 'trip').length}
            onManage={() => navigate("/host/trips")}
            onAdd={() => navigate("/create-trip")}
            accentColor={COLORS.TEAL}
          />

          {/* HOTELS CARD - Only for individual hosts */}
          {!isCompany && (
            <HostCategoryCard 
              title="Stays"
              subtitle="Hotels & Accommodation"
              image="/images/category-hotels.webp"
              icon={<Building className="h-8 w-8" />}
              count={myContent.filter(i => i.type === 'hotel').length}
              onManage={() => navigate("/host/hotels")}
              onAdd={() => navigate("/create-hotel")}
              accentColor={COLORS.CORAL}
            />
          )}

          {/* EXPERIENCES CARD - Only for individual hosts */}
          {!isCompany && (
            <HostCategoryCard 
              title="Experiences"
              subtitle="Outdoor & Adventure"
              image="/images/category-campsite.webp"
              icon={<Tent className="h-8 w-8" />}
              count={myContent.filter(i => i.type === 'adventure').length}
              onManage={() => navigate("/host/experiences")}
              onAdd={() => navigate("/create-adventure")}
              accentColor={COLORS.KHAKI_DARK}
            />
          )}
        </div>
      </main>

      <Footer />
      <MobileBottomBar />
    </div>
  );
};

interface CardProps {
  title: string;
  subtitle: string;
  image: string;
  icon: React.ReactNode;
  count: number;
  onManage: () => void;
  onAdd: () => void;
  accentColor: string;
}

const HostCategoryCard = ({ title, subtitle, image, icon, count, onManage, onAdd, accentColor }: CardProps) => (
  <div className="group relative bg-white rounded-[32px] overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 border border-slate-100 flex flex-col h-[420px]">
    <div className="relative h-1/2 overflow-hidden">
      <img src={image} alt={title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute top-4 left-4">
        <Badge className="bg-white/20 backdrop-blur-md text-white border-none py-1.5 px-3 rounded-full text-[10px] font-black uppercase tracking-widest">
          {count} Listings
        </Badge>
      </div>
      <div className="absolute bottom-4 left-6 right-6">
        <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] mb-1">{subtitle}</p>
        <h2 className="text-2xl font-black text-white uppercase tracking-tighter">{title}</h2>
      </div>
    </div>
    <div className="p-8 flex flex-col justify-between flex-1 bg-white">
      <div className="flex items-start justify-between">
        <div className="p-4 rounded-2xl mb-4" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
          {icon}
        </div>
        <Button variant="ghost" onClick={onManage} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900">
          View All →
        </Button>
      </div>
      <Button 
        onClick={onAdd}
        className="w-full py-7 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-lg transition-all active:scale-95 border-none"
        style={{ background: `linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%)`, boxShadow: `0 8px 20px -6px ${accentColor}88` }}
      >
        <Plus className="h-4 w-4 mr-2 stroke-[3px]" />
        Add New {title.split(' ')[0]}
      </Button>
    </div>
  </div>
);

export default BecomeHost;