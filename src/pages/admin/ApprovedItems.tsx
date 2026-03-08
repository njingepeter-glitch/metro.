import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  Plane, 
  Building, 
  Tent, 
  MapPin, 
  Search, 
  ArrowLeft,
  CheckCircle2,
  EyeOff,
  Eye,
  Mail,
  Phone,
  Globe,
  Loader2
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Consistent Color Palette
const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
  KHAKI: "#F0E68C",
  KHAKI_DARK: "#857F3E",
  RED: "#FF0000",
  SOFT_GRAY: "#F8F9FA"
};

const ITEMS_PER_PAGE = 20;

interface ListingItem {
  id: string;
  name: string;
  type: string;
  location: string;
  country: string;
  created_at: string;
  is_hidden?: boolean;
  created_by?: string;
  creator_email?: string;
  creator_phone?: string;
}

const ApprovedItems = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<ListingItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const getTableName = (type: string) => {
    if (type === "trip") return "trips";
    if (type === "hotel") return "hotels";
    return "adventure_places";
  };

  const handleToggleVisibility = async (item: ListingItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setTogglingId(item.id);
    try {
      const { error } = await supabase
        .from(getTableName(item.type))
        .update({ is_hidden: !item.is_hidden })
        .eq("id", item.id);
      if (error) throw error;
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_hidden: !i.is_hidden } : i));
      setFilteredItems(prev => prev.map(i => i.id === item.id ? { ...i, is_hidden: !i.is_hidden } : i));
      toast({ title: item.is_hidden ? "Listing published" : "Listing hidden" });
    } catch (error) {
      toast({ title: "Failed to update visibility", variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchApprovedItems(0);
  }, [user, navigate]);

  const fetchApprovedItems = async (fetchOffset: number) => {
    if (fetchOffset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    try {
      const [tripsRes, hotelsRes, adventuresRes] = await Promise.all([
        supabase.from("trips").select("id, name, location, country, created_at, is_hidden, created_by").eq("approval_status", "approved").range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1),
        supabase.from("hotels").select("id, name, location, country, created_at, is_hidden, created_by").eq("approval_status", "approved").range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1),
        supabase.from("adventure_places").select("id, name, location, country, created_at, is_hidden, created_by").eq("approval_status", "approved").range(fetchOffset, fetchOffset + ITEMS_PER_PAGE - 1),
      ]);

      const allRawItems = [
        ...(tripsRes.data?.map(t => ({ ...t, type: "trip" })) || []),
        ...(hotelsRes.data?.map(h => ({ ...h, type: "hotel" })) || []),
        ...(adventuresRes.data?.map(a => ({ ...a, type: "adventure" })) || []),
      ];

      // Fetch creator profiles
      const creatorIds = [...new Set(allRawItems.map(i => i.created_by).filter(Boolean))];
      let creatorMap: Record<string, { email?: string; phone_number?: string }> = {};
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, email, phone_number").in("id", creatorIds);
        profiles?.forEach(p => { creatorMap[p.id] = { email: p.email || undefined, phone_number: p.phone_number || undefined }; });
      }

      const allItems: ListingItem[] = allRawItems.map(item => ({
        ...item,
        creator_email: item.created_by ? creatorMap[item.created_by]?.email : undefined,
        creator_phone: item.created_by ? creatorMap[item.created_by]?.phone_number : undefined,
      }));

      const sortedItems = allItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      if (fetchOffset === 0) {
        setItems(sortedItems);
        setFilteredItems(sortedItems);
      } else {
        setItems(prev => [...prev, ...sortedItems]);
        setFilteredItems(prev => [...prev, ...sortedItems]);
      }
      
      setOffset(fetchOffset + ITEMS_PER_PAGE);
      setHasMore(allItems.length >= ITEMS_PER_PAGE);
    } catch (error) {
      console.error("Error fetching approved items:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMore = () => {
    if (hasMore && !loadingMore) {
      fetchApprovedItems(offset);
    }
  };

  useEffect(() => {
    const query = searchQuery.toLowerCase().trim();
    if (query === "") {
      setFilteredItems(items);
    } else {
      setFilteredItems(items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          item.location.toLowerCase().includes(query)
      ));
    }
  }, [searchQuery, items]);

  const getIcon = (type: string) => {
    switch (type) {
      case "trip": return <Plane className="h-5 w-5" />;
      case "hotel": return <Building className="h-5 w-5" />;
      case "adventure": return <Tent className="h-5 w-5" />;
      default: return <MapPin className="h-5 w-5" />;
    }
  };

  if (loading) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header className="hidden md:block" />

      {/* Bold Header Section */}
      <div className="bg-white border-b border-slate-100 pt-10 pb-20 px-4">
        <div className="container mx-auto px-4 space-y-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="rounded-full hover:bg-slate-100 p-2 h-auto"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="space-y-2">
            <Badge className="bg-[#FF7F50] hover:bg-[#FF7F50] border-none px-3 py-1 uppercase font-black tracking-widest text-[10px] rounded-full">
              Admin Portal
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900">
              Approved <span style={{ color: COLORS.TEAL }}>Directory</span>
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Managing {items.length} verified listings
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 -mt-10 relative z-10">
        {/* Styled Search Bar */}
        <div className="relative mb-8 shadow-2xl rounded-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <Input
            type="text"
            placeholder="FILTER BY NAME OR LOCATION..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-16 bg-white border-none rounded-2xl font-black uppercase tracking-wider text-xs placeholder:text-slate-300 focus-visible:ring-2 focus-visible:ring-[#008080]"
          />
        </div>

        {filteredItems.length === 0 ? (
          <Card className="p-16 text-center rounded-[32px] border-dashed border-2 border-slate-200 bg-white/50">
            <p className="font-black uppercase tracking-widest text-slate-400 text-sm">
              No matching listings found
            </p>
          </Card>
        ) : (
          <>
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="w-full group relative bg-white hover:bg-slate-50 border border-slate-100 rounded-3xl transition-all duration-300 shadow-sm hover:shadow-xl"
                >
                  <button
                    onClick={() => navigate(`/admin/review/${item.type}/${item.id}`)}
                    className="w-full flex items-center justify-between p-5"
                  >
                    <div className="flex items-center gap-5">
                      <div 
                        className="h-14 w-14 rounded-2xl flex items-center justify-center transition-colors group-hover:scale-110 duration-300"
                        style={{ backgroundColor: `${COLORS.TEAL}10`, color: COLORS.TEAL }}
                      >
                        {getIcon(item.type)}
                      </div>
                      
                      <div className="text-left space-y-1">
                        <p className="font-black uppercase tracking-tight text-slate-800 leading-none">
                          {item.name}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 text-[#FF7F50]" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {item.location}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Globe className="h-3 w-3 text-[#008080]" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {item.country}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        {item.is_hidden && (
                          <Badge variant="outline" className="text-[9px] border-slate-200 text-slate-400 font-black uppercase tracking-tighter">
                            <EyeOff className="h-3 w-3 mr-1" /> Hidden
                          </Badge>
                        )}
                        <div className="flex items-center gap-1.5 bg-[#F0E68C]/20 px-3 py-1 rounded-full border border-[#F0E68C]/50">
                          <CheckCircle2 className="h-3 w-3 text-[#857F3E]" />
                          <span className="text-[9px] font-black text-[#857F3E] uppercase tracking-widest">Verified</span>
                        </div>
                      </div>
                      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-slate-50 group-hover:bg-[#008080] group-hover:text-white transition-colors">
                        <ChevronRight className="h-5 w-5" />
                      </div>
                    </div>
                  </button>
                  
                  {/* Creator Info & Hide Toggle */}
                  <div className="px-5 pb-4 pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-50">
                    <div className="flex flex-wrap gap-4 text-[10px] text-slate-500">
                      {item.creator_email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-[#008080]" />
                          <span className="font-bold">{item.creator_email}</span>
                        </div>
                      )}
                      {item.creator_phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-[#008080]" />
                          <span className="font-bold">{item.creator_phone}</span>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={item.is_hidden ? "default" : "outline"}
                      onClick={(e) => handleToggleVisibility(item, e)}
                      disabled={togglingId === item.id}
                      className="text-[9px] font-black uppercase tracking-widest h-8 rounded-xl"
                      style={item.is_hidden ? { background: COLORS.TEAL } : {}}
                    >
                      {item.is_hidden ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
                      {item.is_hidden ? "Publish" : "Hide"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && !searchQuery && (
              <div className="flex justify-center mt-10">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-2xl font-black uppercase text-[10px] tracking-widest h-12 px-8"
                  style={{ background: COLORS.TEAL }}
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    "Load More"
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <MobileBottomBar />
    </div>
  );
};

export default ApprovedItems;