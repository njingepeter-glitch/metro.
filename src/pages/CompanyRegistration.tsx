import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Header } from "@/components/Header";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CountrySelector } from "@/components/creation/CountrySelector";
import { ArrowLeft, Building2, Camera, Loader2, CheckCircle2 } from "lucide-react";
import { getCountryPhoneCode } from "@/lib/countryHelpers";

const COLORS = { TEAL: "#008080", CORAL: "#FF7F50", CORAL_LIGHT: "#FF9E7A" };

const CompanyRegistration = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [existingCompany, setExistingCompany] = useState<any>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    company_name: "",
    registration_number: "",
    phone_number: "",
    email: "",
    country: "",
  });

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    const check = async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setExistingCompany(data);
        if (data.verification_status === "approved") {
          navigate("/become-host");
          return;
        }
      }
      const { data: profile } = await supabase.from("profiles").select("email, country").eq("id", user.id).single();
      if (profile) {
        const country = profile.country || "";
        const code = country ? getCountryPhoneCode(country) : "";
        setFormData(prev => ({
          ...prev,
          email: profile.email || user.email || "",
          country,
          phone_number: code,
        }));
      }
      setChecking(false);
    };
    check();
  }, [user, navigate]);

  const handleCountryChange = (country: string) => {
    const code = getCountryPhoneCode(country);
    setFormData(prev => ({
      ...prev,
      country,
      phone_number: code,
    }));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = getCountryPhoneCode(formData.country);
    let val = e.target.value;
    // Ensure the country code prefix stays
    if (!val.startsWith(code)) {
      val = code;
    }
    setFormData({ ...formData, phone_number: val });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.company_name.trim()) {
      toast({ title: "Error", description: "Company name is required", variant: "destructive" });
      return;
    }
    if (!formData.registration_number.trim()) {
      toast({ title: "Error", description: "Registration number is required", variant: "destructive" });
      return;
    }
    const phoneDigits = formData.phone_number.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast({ title: "Error", description: "Valid phone number is required", variant: "destructive" });
      return;
    }
    if (!formData.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    if (!formData.country) {
      toast({ title: "Error", description: "Country is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        const fileName = `companies/${user.id}/${Date.now()}.${photoFile.name.split('.').pop()}`;
        const { error: uploadError } = await supabase.storage.from("profile-photos").upload(fileName, photoFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("profile-photos").getPublicUrl(fileName);
        photoUrl = publicUrl;
      }

      const companyPayload: Record<string, any> = {
          company_name: formData.company_name.trim(),
          registration_number: formData.registration_number.trim(),
          phone_number: formData.phone_number.trim(),
          email: formData.email.trim(),
          country: formData.country,
        };
        if (photoUrl) companyPayload.profile_photo_url = photoUrl;

      if (existingCompany) {
        // Only set verification_status on resubmission of rejected companies
        if (existingCompany.verification_status === "rejected") {
          companyPayload.verification_status = "pending";
        }
        const { error } = await supabase.from("companies").update(companyPayload).eq("id", existingCompany.id);
        if (error) throw error;
      } else {
        companyPayload.user_id = user.id;
        const { error } = await supabase.from("companies").insert(companyPayload as any);
        if (error) throw error;
      }

      toast({ title: "Submitted!", description: "Your company registration is under review." });
      navigate("/verification-status");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (checking) return <div className="min-h-screen bg-[#F8F9FA] animate-pulse" />;

  if (existingCompany?.verification_status === "pending") {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100 max-w-md w-full text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-[#008080]" />
            <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Under Review</h1>
            <p className="text-slate-500 text-sm mb-6">Your company registration is being reviewed. You'll be notified once approved.</p>
            <Button onClick={() => navigate("/")} className="w-full rounded-2xl py-6" style={{ background: COLORS.TEAL }}>
              Return Home
            </Button>
          </div>
        </main>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
      <Header />
      <main className="container px-4 py-8 mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-2xl bg-[#008080]/10">
              <Building2 className="h-8 w-8 text-[#008080]" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-slate-900">
            Register Your <span style={{ color: COLORS.CORAL }}>Company</span>
          </h1>
          <p className="text-slate-500 text-sm mt-2">Tour & travel companies can host trips, tours, and events</p>
          {existingCompany?.verification_status === "rejected" && (
            <div className="mt-4 p-4 bg-red-50 rounded-2xl border border-red-100">
              <p className="text-sm font-bold text-red-600">Previous submission rejected:</p>
              <p className="text-sm text-red-500">{existingCompany.rejection_reason || "Please resubmit with correct details."}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-[28px] p-8 shadow-sm border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Company Photo */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-[#008080]/20">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Company" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-10 w-10 text-slate-400" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 rounded-full bg-[#008080] text-white cursor-pointer shadow-lg">
                  <Camera className="h-4 w-4" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Company Logo/Photo</p>
            </div>

            {/* Company Name */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-[#008080] uppercase tracking-[0.2em]">Company Name *</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Enter company name"
                className="bg-slate-50 border-none rounded-2xl h-14 px-6 font-bold focus-visible:ring-1 focus-visible:ring-[#008080]"
                required
              />
            </div>

            {/* Registration Number */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-[#008080] uppercase tracking-[0.2em]">Registration Number *</Label>
              <Input
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                placeholder="Company registration number"
                className="bg-slate-50 border-none rounded-2xl h-14 px-6 font-bold focus-visible:ring-1 focus-visible:ring-[#008080]"
                required
              />
            </div>

            {/* Country - moved before phone */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-[#008080] uppercase tracking-[0.2em]">Country *</Label>
              <div className="bg-slate-50 rounded-2xl p-2 px-4">
                <CountrySelector value={formData.country} onChange={handleCountryChange} />
              </div>
            </div>

            {/* Phone Number - now with country code */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-[#008080] uppercase tracking-[0.2em]">Phone Number *</Label>
              <Input
                type="tel"
                value={formData.phone_number}
                onChange={handlePhoneChange}
                placeholder={formData.country ? getCountryPhoneCode(formData.country) + "..." : "Select country first"}
                className="bg-slate-50 border-none rounded-2xl h-14 px-6 font-bold focus-visible:ring-1 focus-visible:ring-[#008080]"
                required
                disabled={!formData.country}
              />
              {!formData.country && (
                <p className="text-xs text-muted-foreground">Please select a country first</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-[#008080] uppercase tracking-[0.2em]">Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="company@example.com"
                className="bg-slate-50 border-none rounded-2xl h-14 px-6 font-bold focus-visible:ring-1 focus-visible:ring-[#008080]"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl border-none"
              style={{ background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)` }}
            >
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</> : "Submit Registration"}
            </Button>
          </form>
        </div>
      </main>
      <MobileBottomBar />
    </div>
  );
};

export default CompanyRegistration;
