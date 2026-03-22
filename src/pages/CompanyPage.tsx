import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { ListingCard } from "@/components/ListingCard";
import { ListingSkeleton } from "@/components/ui/listing-skeleton";
import { useSavedItems } from "@/hooks/useSavedItems";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Building2, Mail, Phone, Globe, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

const CompanyPage = () => {
  const { companyName } = useParams<{ companyName: string }>();
  const navigate = useNavigate();
  const { savedItems, handleSave } = useSavedItems();

  // If no companyName, show browse mode
  if (!companyName) {
    return <CompanyBrowse />;
  }

  return <CompanyDetail companyName={companyName} />;
};

/** Browse all companies */
const CompanyBrowse = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allCompanyNames, setAllCompanyNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetchCompanies(0, true);
    // Fetch all names for suggestions
    supabase.from("companies").select("company_name").eq("verification_status", "approved").order("company_name").then(({ data }) => {
      setAllCompanyNames((data || []).map(c => c.company_name));
    });
  }, []);

  const fetchCompanies = async (offset: number, reset = false) => {
    if (reset) setLoading(true);
    else setLoadingMore(true);

    let query = supabase
      .from("companies")
      .select("*")
      .eq("verification_status", "approved")
      .order("company_name", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.ilike("company_name", `%${search.trim()}%`);
    }

    const { data } = await query;
    const items = data || [];

    if (reset) {
      setCompanies(items);
    } else {
      setCompanies(prev => [...prev, ...items]);
    }
    setHasMore(items.length === PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  };

  const handleSearch = (value?: string) => {
    const q = value !== undefined ? value : search;
    setSearch(q);
    setPage(0);
    setShowSuggestions(false);
    // Refetch with the search value
    setTimeout(() => fetchCompanies(0, true), 0);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchCompanies(nextPage * PAGE_SIZE);
  };

  // Suggestions filtered
  const suggestions = search.trim().length >= 2
    ? allCompanyNames.filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 5)
    : [];

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors active:scale-95">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-base font-bold text-foreground">Companies</h1>
      </div>

      <div className="px-4 pt-4 max-w-5xl mx-auto">
        {/* Search with suggestions */}
        <div className="relative mb-6">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowSuggestions(true); }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                className="pl-10 h-11 rounded-xl"
              />
            </div>
            <Button onClick={() => handleSearch()} className="h-11 rounded-xl px-6">Search</Button>
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg z-10 overflow-hidden">
              {suggestions.map((name, i) => (
                <button
                  key={i}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-muted transition-colors flex items-center gap-2"
                  onMouseDown={() => handleSearch(name)}
                >
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-foreground">{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="text-center py-16">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No companies found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => navigate(`/company/${encodeURIComponent(company.company_name)}`)}
                  className="bg-card rounded-2xl border border-border p-4 text-left hover:shadow-md transition-all active:scale-[0.98] group"
                >
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden mx-auto mb-3 border border-primary/20">
                    {company.profile_photo_url ? (
                      <img src={company.profile_photo_url} alt={company.company_name} className="h-full w-full object-cover" />
                    ) : (
                      <Building2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground text-center truncate">{company.company_name}</p>
                  {company.country && (
                    <p className="text-xs text-muted-foreground text-center mt-0.5">{company.country}</p>
                  )}
                </button>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button onClick={loadMore} disabled={loadingMore} variant="outline" className="rounded-xl px-8">
                  {loadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

/** Single company detail with listings */
const CompanyDetail = ({ companyName }: { companyName: string }) => {
  const navigate = useNavigate();
  const { savedItems, handleSave } = useSavedItems();
  const [company, setCompany] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchCompany();
  }, [companyName]);

  const fetchCompany = async () => {
    setLoading(true);
    const decodedName = decodeURIComponent(companyName);
    const { data: companyData } = await supabase
      .from("companies").select("*").eq("verification_status", "approved")
      .ilike("company_name", decodedName).maybeSingle();

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
      .eq("created_by", userId).eq("approval_status", "approved").eq("is_hidden", false)
      .order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);

    const newItems = (data || []).map(item => ({ ...item, type: item.type === "event" ? "EVENT" : "TRIP" }));
    if (offset === 0) setItems(newItems);
    else setItems(prev => [...prev, ...newItems]);
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
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="px-4 pt-6 space-y-4 max-w-5xl mx-auto">
          <Skeleton className="h-32 rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <ListingSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="text-base font-bold">Company</h1>
        </div>
        <div className="px-4 pt-16 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-lg font-bold text-foreground mb-1">Not Found</p>
          <p className="text-sm text-muted-foreground mb-6">This company doesn't exist or isn't verified.</p>
          <Button onClick={() => navigate("/company")} variant="outline" className="rounded-xl">Browse Companies</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors active:scale-95">
          <ArrowLeft className="h-5 w-5 text-foreground" />
        </button>
        <h1 className="text-base font-bold text-foreground truncate">{company.company_name}</h1>
      </div>

      <div className="px-4 pt-6 max-w-5xl mx-auto">
        {/* Company Header */}
        <div className="bg-card rounded-2xl p-5 border border-border mb-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border-2 border-primary/20 shrink-0">
              {company.profile_photo_url ? (
                <img src={company.profile_photo_url} alt={company.company_name} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-7 w-7 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-foreground">{company.company_name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                {company.country && <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{company.country}</span>}
                {company.phone_number && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{company.phone_number}</span>}
                {company.email && <a href={`mailto:${company.email}`} className="flex items-center gap-1 text-primary hover:underline"><Mail className="h-3.5 w-3.5" />{company.email}</a>}
              </div>
            </div>
          </div>
        </div>

        {/* Listings */}
        <h3 className="text-sm font-bold text-foreground mb-3">Trips & Events ({items.length}{hasMore ? "+" : ""})</h3>

        {items.length === 0 ? (
          <div className="text-center py-12"><p className="text-muted-foreground text-sm">No listings yet.</p></div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((item) => (
                <ListingCard key={item.id} id={item.id} type={item.type} name={item.name} imageUrl={item.image_url} location={item.location} country={item.country} price={item.price || 0} date={item.date} isCustomDate={item.is_custom_date} isFlexibleDate={item.is_flexible_date} isSaved={savedItems.has(item.id)} onSave={() => handleSave(item.id, item.type)} showBadge activities={item.activities} description={item.description} place={item.place} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <Button onClick={loadMore} disabled={loadingMore} variant="outline" className="rounded-xl px-8">
                  {loadingMore ? "Loading..." : "Load More"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CompanyPage;
