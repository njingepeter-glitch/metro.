import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Footer } from "@/components/Footer";
import { ListingCard } from "@/components/ListingCard";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { useSavedItems } from "@/hooks/useSavedItems";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, Mail, Phone, Globe, MapPin } from "lucide-react";

const PAGE_SIZE = 20;

const CompanyPage = () => {
  const { companyName } = useParams<{ companyName: string }>();
  const navigate = useNavigate();
  const { savedItems, handleSave } = useSavedItems();
  const [company, setCompany] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (companyName) fetchCompany();
  }, [companyName]);

  const fetchCompany = async () => {
    setLoading(true);
    const decodedName = decodeURIComponent(companyName || "");
    
    // Find company by name
    const { data: companyData } = await supabase
      .from("companies")
      .select("*")
      .eq("verification_status", "approved")
      .ilike("company_name", decodedName)
      .maybeSingle();

    if (companyData) {
      setCompany(companyData);
      await fetchItems(companyData.user_id, 0);
    }
    setLoading(false);
  };

  const fetchItems = async (userId: string, offset: number) => {
    const { data } = await supabase
      .from("trips")
      .select("id,name,location,place,country,image_url,date,is_custom_date,is_flexible_date,available_tickets,activities,type,created_at,price,price_child,description")
      .eq("created_by", userId)
      .eq("approval_status", "approved")
      .eq("is_hidden", false)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const newItems = (data || []).map(item => ({
      ...item,
      type: item.type === "event" ? "EVENT" : "TRIP",
    }));

    if (offset === 0) {
      setItems(newItems);
    } else {
      setItems(prev => [...prev, ...newItems]);
    }
    setHasMore(newItems.length === PAGE_SIZE);
  };

  const loadMore = async () => {
    if (!company || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    await fetchItems(company.user_id, nextPage * PAGE_SIZE);
    setPage(nextPage);
    setLoadingMore(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <Header />
        <main className="container px-4 py-8 mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-slate-200 rounded-[28px]" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <ListingSkeleton key={i} />)}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-[#F8F9FA]">
        <Header />
        <main className="container px-4 py-16 mx-auto text-center">
          <Building2 className="h-16 w-16 mx-auto text-slate-300 mb-4" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Company Not Found</h1>
          <p className="text-slate-500 mb-6">The company you're looking for doesn't exist or isn't verified yet.</p>
          <Button onClick={() => navigate("/")} className="bg-[#008080]">Go Home</Button>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <Header />
      <main className="flex-1 container px-4 py-8 mx-auto pb-24 md:pb-8">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 rounded-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Back</span>
        </Button>

        {/* Company Header */}
        <div className="bg-white rounded-[28px] p-6 md:p-8 shadow-sm border border-slate-100 mb-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="h-24 w-24 rounded-full bg-[#008080]/10 flex items-center justify-center overflow-hidden border-4 border-[#008080]/20 shrink-0">
              {company.profile_photo_url ? (
                <img src={company.profile_photo_url} alt={company.company_name} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-10 w-10 text-[#008080]" />
              )}
            </div>
            <div className="flex-1 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 mb-2">
                {company.company_name}
              </h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-slate-500">
                {company.country && (
                  <span className="flex items-center gap-1">
                    <Globe className="h-4 w-4" /> {company.country}
                  </span>
                )}
                {company.phone_number && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-4 w-4" /> {company.phone_number}
                  </span>
                )}
                {company.email && (
                  <a href={`mailto:${company.email}`} className="flex items-center gap-1 text-[#008080] hover:underline">
                    <Mail className="h-4 w-4" /> {company.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Listings */}
        <h2 className="text-lg font-black uppercase tracking-tight text-slate-800 mb-4">
          Trips & Events ({items.length}{hasMore ? "+" : ""})
        </h2>

        {items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-slate-400">No trips or events listed yet.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <ListingCard
                  key={item.id}
                  id={item.id}
                  type={item.type}
                  name={item.name}
                  imageUrl={item.image_url}
                  location={item.location}
                  country={item.country}
                  price={item.price || 0}
                  date={item.date}
                  isCustomDate={item.is_custom_date}
                  isFlexibleDate={item.is_flexible_date}
                  isSaved={savedItems.has(item.id)}
                  onSave={() => handleSave(item.id, item.type)}
                  showBadge={true}
                  activities={item.activities}
                  description={item.description}
                  place={item.place}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <Button onClick={loadMore} disabled={loadingMore} variant="outline" className="rounded-2xl px-8 py-6 font-bold">
                  {loadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
      <MobileBottomBar />
    </div>
  );
};

export default CompanyPage;
