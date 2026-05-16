import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Loader2, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AuthLayout from "@/components/auth/AuthLayout";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send reset email");
      }

      setEmailSent(true);
    } catch (error: any) {
      toast({
        title: "Something went wrong",
        description: error.message || "Failed to send reset email",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      panelQuote="Patient data is only as valuable as the access control protecting it. VeriHealth keeps both clinicians and patients safe."
      panelAuthor="VeriHealth Security Team"
    >
      <div className="space-y-7">
        <div className="space-y-2">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-400 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight">VeriHealth</span>
          </div>

          {!emailSent ? (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
                Forgot your password?
              </h1>
              <p className="text-muted-foreground text-sm">
                No worries — enter your email and we'll send you a reset link.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
                Check your inbox
              </h1>
              <p className="text-muted-foreground text-sm">
                We've sent password reset instructions to your email.
              </p>
            </>
          )}
        </div>

        {emailSent ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-center space-y-1">
                <p className="font-semibold text-foreground">Email sent to</p>
                <p className="text-teal-600 font-medium">{email}</p>
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-xs">
                Click the link in the email to reset your password. The link expires in 1 hour.
              </p>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-400 to-indigo-600 text-white hover:from-teal-500 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 rounded-xl"
              onClick={() => setLocation("/login")}
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>

            <button
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4"
              onClick={() => setEmailSent(false)}
              data-testid="button-try-different-email"
            >
              Try a different email address
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email address</Label>
                <Input
                  id="email"
                  placeholder="doctor@hospital.org"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  data-testid="input-email"
                  className="h-12 rounded-xl border-slate-200 shadow-sm focus:border-teal-400 text-base"
                />
              </div>

              <Button
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-400 to-indigo-600 text-white hover:from-teal-500 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 rounded-xl"
                type="submit"
                disabled={isLoading}
                data-testid="button-send-reset-email"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Reset Link
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 font-medium text-teal-600 hover:text-indigo-600 hover:underline underline-offset-4 transition-colors"
                data-testid="link-back-to-login"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to login
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
