import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBottomBar } from "@/components/MobileBottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = {
  TEAL: "#008080",
  CORAL: "#FF7F50",
  CORAL_LIGHT: "#FF9E7A",
};

const ForgotPassword = () => {
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const validatePassword = (pwd: string): { valid: boolean; message?: string } => {
    if (pwd.length < 8) return { valid: false, message: "Password must be at least 8 characters long" };
    if (!/[A-Z]/.test(pwd)) return { valid: false, message: "Add at least one uppercase letter" };
    if (!/[0-9]/.test(pwd)) return { valid: false, message: "Add at least one number" };
    if (!/[!@#$%^&*()]/.test(pwd)) return { valid: false, message: "Add one special character" };
    return { valid: true };
  };

  const handleSendResetLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setStep('sent');
      toast({ title: "Reset link sent!", description: "Check your email for a password reset link." });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthenticatedPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!user?.email) {
      setError("Please log in again and try once more");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      setError(validation.message || "Invalid password");
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) throw new Error("Current password is incorrect");

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      await supabase.auth.signOut({ scope: 'global' });
      toast({ title: "Password updated", description: "Please log in with your new password." });
      navigate("/auth");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const AuthHeader = ({ icon: Icon, title, subtitle }: { icon: any, title: string, subtitle: string }) => (
    <div className="flex flex-col items-center mb-8">
      <div className="bg-primary/10 p-4 rounded-2xl mb-4">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-3xl font-black uppercase tracking-tighter text-foreground text-center">{title}</h1>
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-2 text-center px-4">
        {subtitle}
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <Header className="hidden md:block" />
      
      <main className="container px-4 pt-12 max-w-lg mx-auto relative z-10">
        <div className="bg-card rounded-[32px] p-8 md:p-10 shadow-2xl border border-border transition-all duration-500">
          {user ? (
            <form onSubmit={handleAuthenticatedPasswordChange} className="space-y-5">
              <AuthHeader icon={Lock} title="Change Password" subtitle="Confirm your current password, then set a new one" />

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Current Password</Label>
                <div className="relative">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    className="rounded-2xl border-border bg-muted/50 h-14 pr-12"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">New Password</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    className="rounded-2xl border-border bg-muted/50 h-14 pr-12"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrength password={newPassword} />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Confirm Password</Label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    className="rounded-2xl border-border bg-muted/50 h-14"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-[10px] font-bold uppercase tracking-tight"><AlertTriangle className="h-4 w-4" /> {error}</div>}
              <PrimaryButton loading={loading} text="Change Password" disabled={!currentPassword || !newPassword || newPassword !== confirmPassword || !validatePassword(newPassword).valid} />
            </form>
          ) : (
            <>
              {step === 'email' && (
                <form onSubmit={handleSendResetLink} className="space-y-6">
                  <AuthHeader icon={Mail} title="Recovery" subtitle="Enter your email to receive a password reset link" />
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
                    <Input 
                      type="email" 
                      className="rounded-2xl border-border bg-muted/50 h-14" 
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  {error && <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-[10px] font-bold uppercase tracking-tight"><AlertTriangle className="h-4 w-4" /> {error}</div>}
                  <PrimaryButton loading={loading} text="Send Reset Link" disabled={!email} />
                  <p className="text-center text-xs text-muted-foreground">
                    Remember your password?{" "}
                    <button type="button" onClick={() => navigate("/auth")} className="text-primary hover:underline font-semibold">
                      Log in
                    </button>
                  </p>
                </form>
              )}

              {step === 'sent' && (
                <div className="space-y-8 text-center">
                  <AuthHeader icon={CheckCircle2} title="Check Your Email" subtitle={`We sent a password reset link to ${email}`} />
                  <p className="text-sm text-muted-foreground">
                    Click the link in the email to reset your password. If you don't see the email, check your spam folder.
                  </p>
                  <div className="space-y-3">
                    <Button
                      onClick={() => setStep('email')}
                      variant="outline"
                      className="w-full rounded-2xl h-12 font-bold uppercase text-[10px] tracking-widest"
                    >
                      Send Again
                    </Button>
                    <Button
                      onClick={() => navigate("/auth")}
                      className="w-full rounded-2xl h-12 font-bold uppercase text-[10px] tracking-widest"
                    >
                      Go to Login
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <Footer className="pb-24" />
      <MobileBottomBar />
    </div>
  );
};

const PrimaryButton = ({ text, loading, disabled }: { text: string, loading?: boolean, disabled?: boolean }) => (
  <Button 
    type="submit" 
    disabled={disabled || loading}
    className="w-full py-8 rounded-2xl text-md font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95 border-none"
    style={{ 
        background: `linear-gradient(135deg, ${COLORS.CORAL_LIGHT} 0%, ${COLORS.CORAL} 100%)`,
        boxShadow: `0 12px 24px -8px ${COLORS.CORAL}88`
    }}
  >
    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : text}
  </Button>
);

export default ForgotPassword;
