import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Sparkles, Mail, Loader2, ArrowLeft } from "lucide-react";
import { PasswordStrength } from "@/components/ui/password-strength";
import { generateStrongPassword } from "@/lib/passwordUtils";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { signInWithGoogleNative } from "@/lib/nativeGoogleAuth";

const generateUserFriendlyId = (email: string): string => {
  const username = email.split("@")[0];
  const cleanName = username
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s.-]/g, "")
    .replace(/[\s.]+/g, "-")
    .replace(/-+/g, "-")
    .substring(0, 20);

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return `${cleanName}-${code}`;
};

type FormErrors = {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  otp?: string;
};

type SignupStep = "form" | "verify";

export const SignupForm = () => {
  const [step, setStep] = useState<SignupStep>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState<string>("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [generatedUserId, setGeneratedUserId] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const validatePassword = (pwd: string): { valid: boolean; message?: string } => {
    if (pwd.length < 8) return { valid: false, message: "Password must be at least 8 characters long" };
    if (!/[A-Z]/.test(pwd)) return { valid: false, message: "Must contain at least one uppercase letter" };
    if (!/[a-z]/.test(pwd)) return { valid: false, message: "Must contain at least one lowercase letter" };
    if (!/[0-9]/.test(pwd)) return { valid: false, message: "Must contain at least one number" };
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd))
      return { valid: false, message: "Must contain at least one special character" };
    return { valid: true };
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (password !== confirmPassword) {
      setErrors({ confirmPassword: "Passwords don't match" });
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setErrors({ password: passwordValidation.message });
      return;
    }

    setLoading(true);

    try {
      const friendlyUserId = generateUserFriendlyId(email);
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", friendlyUserId)
        .single();

      const finalUserId = existingProfile ? generateUserFriendlyId(email + Math.random()) : friendlyUserId;
      setGeneratedUserId(finalUserId);

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, gender, friendly_id: finalUserId },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;

      await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });

      setStep("verify");
    } catch (error: any) {
      setErrors({ email: error.message });
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || otp;
    if (code.length !== 6) {
      setErrors({ otp: "Please enter the complete 6-digit code" });
      return;
    }

    setVerifying(true);
    setErrors({});

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });
      if (error) throw error;
      navigate("/");
    } catch (error: any) {
      setErrors({ otp: error.message || "Invalid verification code" });
      toast({ title: "Verification failed", description: error.message || "Invalid code", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      });
      if (error) throw error;
      toast({ title: "Code resent", description: "Check your email for the new code." });
    } catch (error: any) {
      toast({ title: "Failed to resend", description: error.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const handleGoogleSignup = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogleNative();
      if (result) {
        navigate("/");
      }
    } catch (error: any) {
      toast({ title: "Google signup failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // OTP Verification step
  if (step === "verify") {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Check your email</h3>
          <p className="text-sm text-muted-foreground">
            We sent a 6-digit code to <strong className="text-foreground">{email}</strong>
          </p>
          {generatedUserId && (
            <p className="text-xs font-mono text-primary bg-primary/5 py-2 px-3 rounded-lg inline-block">
              Your ID: {generatedUserId}
            </p>
          )}
        </div>

        <div className="space-y-5">
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(value) => {
                setOtp(value);
                if (value.length === 6) {
                  setTimeout(() => handleVerifyOtp(value), 100);
                }
              }}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>

          {errors.otp && (
            <p className="text-xs text-destructive text-center">{errors.otp}</p>
          )}

          {verifying && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verifying...
            </div>
          )}

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-1">Didn't receive the code?</p>
            <Button variant="link" onClick={handleResendCode} disabled={resending} className="text-sm p-0 h-auto">
              {resending ? "Sending..." : "Resend code"}
            </Button>
          </div>

          <button
            onClick={() => setStep("form")}
            className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to signup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Google Button first */}
      <button
        type="button"
        onClick={handleGoogleSignup}
        className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-semibold text-foreground transition-all hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Sign up with Google
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-3 text-muted-foreground font-medium">or continue with email</span>
        </div>
      </div>

      {/* Signup form */}
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-foreground">Full name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`h-11 rounded-xl ${errors.name ? "border-destructive" : ""}`}
              required
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender" className="text-sm font-medium text-foreground">Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-email" className="text-sm font-medium text-foreground">Email address</Label>
          <Input
            id="signup-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`h-11 rounded-xl ${errors.email ? "border-destructive" : ""}`}
            required
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="signup-password" className="text-sm font-medium text-foreground">Password</Label>
            <button
              type="button"
              onClick={handleGeneratePassword}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Sparkles className="h-3 w-3" />
              Generate
            </button>
          </div>
          <div className="relative">
            <Input
              id="signup-password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`h-11 rounded-xl pr-10 ${errors.password ? "border-destructive" : ""}`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <PasswordStrength password={password} />
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`h-11 rounded-xl pr-10 ${errors.confirmPassword ? "border-destructive" : ""}`}
              required
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl text-sm font-semibold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground leading-relaxed">
          By signing up, you agree to our{" "}
          <a href="/terms" className="text-primary hover:underline">Terms of Service</a>{" "}
          and{" "}
          <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
        </p>
      </form>
    </div>
  );
};
