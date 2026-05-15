import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Loader2, Eye, EyeOff, Clock } from "lucide-react";
import { login } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import AuthLayout from "@/components/auth/AuthLayout";
import { isPatientAppHost, navigateToRoleHome } from "@/lib/runtime";

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [clinicianPending, setClinicianPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setClinicianPending(false);

    try {
      const session = await login({ email, password });

      toast({
        title: "Welcome back",
        description: "Signed in successfully.",
      });

      navigateToRoleHome(session.user.role, setLocation);
    } catch (error: any) {
      const errorData = error.data || {};

      if (errorData.approvalStatus === "pending") {
        setClinicianPending(true);
        toast({
          title: "Account pending approval",
          description:
            "Your clinician account is awaiting approval from your institution administrator.",
          variant: "destructive",
          duration: 8000,
        });
      } else {
        toast({
          title: "Sign in failed",
          description: error.message || "Invalid email or password",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <AuthLayout
      panelQuote="VeriHealth has transformed how we monitor chronic conditions. The real-time risk scoring helps us intervene days before a crisis occurs."
      panelAuthor="Dr. Sarah Chen, Chief of Cardiology"
    >
      <div className="space-y-7">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-400 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">VeriHealth</span>
          </div>
          <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="text-muted-foreground text-sm">
            {isPatientAppHost()
              ? "Sign in to access your health app."
              : "Sign in to access your clinical dashboard."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <Input
              id="email"
              placeholder={isPatientAppHost() ? "patient@example.com" : "doctor@hospital.org"}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              data-testid="input-email"
              className="h-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-sm font-medium">Password</Label>
              <a
                href="/forgot-password"
                className="text-xs text-teal-600 hover:text-indigo-600 hover:underline transition-colors"
                data-testid="link-forgot-password"
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
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
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>
          </div>

          <Button
            className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-400 to-indigo-600 text-white hover:from-teal-500 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 rounded-xl"
            type="submit"
            disabled={isLoading}
            data-testid="button-sign-in"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        {clinicianPending && (
          <div
            className="bg-amber-50 p-4 rounded-xl border border-amber-200"
            data-testid="alert-clinician-pending"
          >
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-0.5">
                  Account pending approval
                </p>
                <p className="text-sm text-amber-800">
                  Your clinician account is awaiting approval from your institution administrator.
                  You'll receive an email once approved.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a
              href="/register"
              className="font-medium text-teal-600 hover:text-indigo-600 hover:underline underline-offset-4 transition-colors"
              data-testid="link-register"
            >
              Create account
            </a>
          </p>
          {!isPatientAppHost() && (
            <p className="text-sm text-muted-foreground">
              Healthcare provider?{" "}
              <a
                href="/register-clinician"
                className="font-medium text-teal-600 hover:text-indigo-600 hover:underline underline-offset-4 transition-colors"
                data-testid="link-register-clinician"
              >
                Register as Clinician
              </a>
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground/70">
          By signing in you agree to our{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="underline underline-offset-4 hover:text-primary">
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </AuthLayout>
  );
}
