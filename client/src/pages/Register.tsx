import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Loader2, UserPlus, Eye, EyeOff, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { setAuthToken, setUser } from "@/lib/auth";
import AuthLayout from "@/components/auth/AuthLayout";

function getPasswordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (!pw) return { level: 0, label: "", color: "" };
  const hasLength = pw.length >= 8;
  const hasNumber = /\d/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const score = (hasLength ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSymbol ? 1 : 0);
  if (score === 3) return { level: 3, label: "Strong", color: "bg-green-500" };
  if (score === 2) return { level: 2, label: "Fair", color: "bg-amber-400" };
  return { level: 1, label: "Weak", color: "bg-red-400" };
}

export default function Register() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const params = new URLSearchParams(search);
  const inviteToken = params.get("invite");
  const [inviteInfo, setInviteInfo] = useState<{ role?: string; email?: string } | null>(null);

  const strength = getPasswordStrength(password);

  useEffect(() => {
    if (inviteToken) {
      fetch(`/api/auth/verify-invite?token=${inviteToken}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) {
            setInviteInfo(data);
            if (data.email) setEmail(data.email);
          }
        })
        .catch(() => {});
    }
  }, [inviteToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are identical",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(inviteToken ? { inviteToken } : {}) }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Registration failed");
      }

      const data = await response.json();

      if (data.session?.access_token) {
        setAuthToken(data.session.access_token);
        const userResponse = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData.user);
          toast({ title: "Registration successful", description: "Welcome to VeriHealth!" });
          setLocation(userData.user.role === "patient" ? "/patient" : "/");
          return;
        }
      }

      toast({
        title: "Registration successful",
        description: "Your account is ready. Sign in to continue.",
      });
      setLocation("/login");
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "Unable to create account",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      panelFeatures={[
        "Real-time vital signs monitoring",
        "AI-powered risk detection & early alerts",
        "Secure, HIPAA-compliant data handling",
        "Multi-provider care coordination",
      ]}
      panelQuote="Start monitoring health with confidence — wherever you are."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-400 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">VeriHealth</span>
          </div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
            Create an account
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter your details to get started with VeriHealth.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              placeholder="doctor@hospital.org"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading || !!inviteInfo?.email}
              data-testid="input-email"
              className="h-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-password"
                className="h-12 pr-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-toggle-password"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && (
              <div className="space-y-1" data-testid="password-strength">
                <div className="flex gap-1">
                  {[1, 2, 3].map((s) => (
                    <div
                      key={s}
                      className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                        strength.level >= s ? strength.color : "bg-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Strength:{" "}
                  <span
                    className={
                      strength.level === 3
                        ? "text-green-600 font-medium"
                        : strength.level === 2
                        ? "text-amber-600 font-medium"
                        : "text-red-500 font-medium"
                    }
                  >
                    {strength.label}
                  </span>
                  {strength.level < 3 && (
                    <span className="ml-1">— add {!password.match(/\d/) ? "a number" : "a symbol"}</span>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
                data-testid="input-confirm-password"
                className="h-12 pr-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="button-toggle-confirm-password"
                aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="bg-teal-50 border border-teal-200 rounded-xl p-3.5">
            {inviteInfo ? (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-0.5 text-teal-600 flex-shrink-0" />
                <p className="text-sm text-teal-800">
                  You've been invited to join as{" "}
                  <strong className="capitalize">
                    {inviteInfo.role?.replace("_", " ") || "Patient"}
                  </strong>
                  . Your role will be set automatically.
                </p>
              </div>
            ) : (
              <p className="text-sm text-teal-800">
                New accounts are created as <strong>Patient</strong> accounts. Contact an
                administrator if you need healthcare provider access.
              </p>
            )}
          </div>

          <Button
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-400 to-indigo-600 text-white hover:from-teal-500 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 rounded-xl"
            type="submit"
            disabled={isLoading}
            data-testid="button-register"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" />
                Create Account
              </>
            )}
          </Button>
        </form>

        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-teal-600 hover:text-indigo-600 hover:underline underline-offset-4 transition-colors"
              data-testid="link-login"
            >
              Sign in
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            Healthcare provider?{" "}
            <Link
              href="/register-clinician"
              className="font-medium text-teal-600 hover:text-indigo-600 hover:underline underline-offset-4 transition-colors"
              data-testid="link-register-clinician"
            >
              Register as Clinician
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground/70">
          By creating an account, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </AuthLayout>
  );
}
