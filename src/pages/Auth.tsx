import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { SEOHead } from "@/components/SEOHead";
import { Header } from "@/components/Header";
import { Home, MapPin, Shield, Star } from "lucide-react";


const Auth = () => {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return <div className="min-h-screen bg-background animate-pulse" />;
  }

  return (
    <div className="brand-shell min-h-screen flex flex-col">
      {/* Header visible on large screens */}
      <div className="hidden lg:block">
        <Header />
      </div>
      <div className="flex-1 flex flex-col lg:flex-row">
      <SEOHead
        title="Sign In or Sign Up | Realtravo"
        description="Create an account or sign in to Realtravo to book trips, save favorites, and manage your travel experiences."
      />

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[48%] relative overflow-hidden bg-primary">
        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-primary-foreground/5" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-primary-foreground/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-primary-foreground/[0.03]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/fulllogo.png" alt="Realtravo" className="h-10 brightness-0 invert" />
          </div>

          {/* Main copy */}
          <div className="space-y-8">
            <div>
              <h1 className="text-5xl font-extrabold text-primary-foreground leading-[1.1] tracking-tight">
                Discover.<br />
                Book.<br />
                <span className="text-primary-foreground/70">Experience.</span>
              </h1>
              <p className="mt-6 text-primary-foreground/60 text-lg max-w-sm leading-relaxed">
                Your gateway to curated adventures, hotels, and unforgettable trips across Africa.
              </p>
            </div>

            {/* Feature pills */}
            <div className="flex flex-col gap-4">
              {[
                { icon: MapPin, text: "Handpicked stays, trips & adventures" },
                { icon: Shield, text: "Book with confidence, pay securely" },
                { icon: Star, text: "Real reviews from real travelers" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-primary-foreground/80" />
                  </div>
                  <span className="text-primary-foreground/70 text-sm font-medium">{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-primary-foreground/30 text-xs">
            © {new Date().getFullYear()} Realtravo. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="flex-1 flex flex-col min-h-screen bg-background relative overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex items-center justify-between p-4 lg:p-8 lg:pb-0">
          <img src="/fulllogo.png" alt="Realtravo" className="h-7 lg:hidden" />
          <button
            type="button"
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium">Home</span>
          </button>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-4 py-8 lg:px-12">
          <div className="w-full max-w-[420px] space-y-8">
            {/* Header */}
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">
                {activeTab === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-1 text-muted-foreground text-sm">
                {activeTab === "login"
                  ? "Sign in to continue your journey"
                  : "Join Realtravo and start exploring"}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex bg-muted rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab("login")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === "login"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab("signup")}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === "signup"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sign Up
              </button>
            </div>

            {/* Forms */}
            <div>
              {activeTab === "login" ? (
                <LoginForm onSwitchToSignup={() => setActiveTab("signup")} />
              ) : (
                <SignupForm />
              )}
            </div>
          </div>
        </div>

        {/* Mobile footer */}
        <div className="p-4 text-center lg:hidden">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Realtravo. All rights reserved.
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default Auth;
