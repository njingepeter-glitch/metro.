import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Building2, CheckCircle, XCircle, Eye, EyeOff, Search } from "lucide-react";

const CompanyReview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyItems, setCompanyItems] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    setCompanies(data || []);

    // Fetch trips/events for each approved company
    if (data) {
      const approvedCompanies = data.filter(c => c.verification_status === "approved");
      const itemsMap: Record<string, any[]> = {};
      for (const company of approvedCompanies) {
        const { data: trips } = await supabase
          .from("trips")
          .select("id,name,type,approval_status,is_hidden,created_at")
          .eq("created_by", company.user_id)
          .order("created_at", { ascending: false });
        itemsMap[company.id] = trips || [];
      }
      setCompanyItems(itemsMap);
    }
    setLoading(false);
  };

  const handleVerify = async (companyId: string, status: "approved" | "rejected", reason?: string) => {
    const { error } = await supabase.from("companies").update({
      verification_status: status,
      verified_at: new Date().toISOString(),
      verified_by: user?.id,
      rejection_reason: status === "rejected" ? (reason || "Does not meet requirements") : null,
    }).eq("id", companyId);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Company ${status}` });
      fetchCompanies();
    }
  };

  const handleToggleHide = async (itemId: string, currentHidden: boolean) => {
    const { error } = await supabase.from("trips").update({ is_hidden: !currentHidden }).eq("id", itemId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: currentHidden ? "Item unhidden" : "Item hidden" });
      fetchCompanies();
    }
  };

  const filtered = companies.filter(c => {
    if (filter !== "all" && c.verification_status !== filter) return false;
    if (searchQuery && !c.company_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      <main className="container px-4 py-8 mx-auto">
        <Button variant="ghost" onClick={() => navigate("/admin")} className="mb-6 rounded-full">
          <ArrowLeft className="mr-2 h-4 w-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Admin</span>
        </Button>

        <h1 className="text-3xl font-black uppercase tracking-tighter mb-6">
          Company <span className="text-[#FF7F50]">Review</span>
        </h1>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["all", "pending", "approved", "rejected"] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="rounded-full text-xs font-bold uppercase"
              style={filter === f ? { background: "#008080" } : {}}
            >
              {f} ({companies.filter(c => f === "all" || c.verification_status === f).length})
            </Button>
          ))}
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 rounded-2xl h-12"
          />
        </div>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-slate-200 rounded-[20px] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-slate-400 py-12">No companies found.</p>
        ) : (
          <div className="space-y-4">
            {filtered.map(company => (
              <div key={company.id} className="bg-white rounded-[20px] p-6 shadow-sm border border-slate-100">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-[#008080]/10 flex items-center justify-center overflow-hidden">
                      {company.profile_photo_url ? (
                        <img src={company.profile_photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5 text-[#008080]" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{company.company_name}</h3>
                      <p className="text-xs text-slate-400">Reg: {company.registration_number}</p>
                      <p className="text-xs text-slate-400">{company.email} • {company.phone_number}</p>
                      <p className="text-xs text-slate-400">{company.country}</p>
                    </div>
                  </div>
                  <Badge
                    className={`text-[10px] uppercase ${
                      company.verification_status === "approved" ? "bg-green-100 text-green-700" :
                      company.verification_status === "rejected" ? "bg-red-100 text-red-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {company.verification_status}
                  </Badge>
                </div>

                {company.verification_status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleVerify(company.id, "approved")}
                      className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 text-white"
                      size="sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      onClick={() => {
                        const reason = prompt("Rejection reason:");
                        if (reason) handleVerify(company.id, "rejected", reason);
                      }}
                      className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}

                {/* Company items */}
                {companyItems[company.id] && companyItems[company.id].length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                      Trips & Events ({companyItems[company.id].length})
                    </h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {companyItems[company.id].map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <div>
                            <p className="text-sm font-bold text-slate-700">{item.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase">{item.type} • {item.approval_status}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleHide(item.id, item.is_hidden)}
                              className="rounded-lg"
                            >
                              {item.is_hidden ? <EyeOff className="h-4 w-4 text-red-400" /> : <Eye className="h-4 w-4 text-green-600" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/admin/review/trip/${item.id}`)}
                              className="rounded-lg text-[10px] font-bold"
                            >
                              Review
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CompanyReview;
