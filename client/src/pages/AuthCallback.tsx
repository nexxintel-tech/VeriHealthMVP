import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { setAuthToken, setUser } from "@/lib/auth";
import { Activity, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [isPatient, setIsPatient] = useState(false);

  useEffect(() => {
    handleCallback();
  }, []);

  async function handleCallback() {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (!accessToken) {
          setError("Authentication failed. Please try again.");
          return;
        }

        const response = await fetch('/api/auth/google-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.isPatient) {
            setIsPatient(true);
            return;
          }
          setError(data.error || "Authentication failed");
          return;
        }

        setAuthToken(data.session.access_token);
        setUser(data.user);
        setLocation("/");
        return;
      }

      const response = await fetch('/api/auth/google-callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.isPatient) {
          setIsPatient(true);
          return;
        }
        setError(data.error || "Authentication failed");
        return;
      }

      setAuthToken(session.access_token);
      setUser(data.user);
      setLocation("/");
    } catch (err: any) {
      console.error("Auth callback error:", err);
      setError("Something went wrong. Please try again.");
    }
  }

  if (isPatient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8" data-testid="screen-patient-blocked-oauth">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Access Restricted</h1>
            <p className="text-muted-foreground">
              This portal is for clinicians and administrators only. To view your health data, please use the VeriHealth mobile app.
            </p>
          </div>
          <div className="space-y-3">
            <a
              href="https://app.verihealths.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full h-11 rounded-md bg-primary text-primary-foreground text-base font-medium hover:bg-primary/90 transition-colors"
              data-testid="link-go-to-patient-app-oauth"
            >
              Go to VeriHealth App
            </a>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation("/login")}
              data-testid="button-back-to-login"
            >
              Back to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Authentication Failed</h1>
            <p className="text-muted-foreground">{error}</p>
          </div>
          <Button
            onClick={() => setLocation("/login")}
            className="w-full"
            data-testid="button-back-to-login-error"
          >
            Back to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight">VeriHealth</span>
        </div>
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
