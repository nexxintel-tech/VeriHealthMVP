import { useEffect } from "react";
import { useLocation } from "wouter";
import { Activity, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthCallback() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timeout = window.setTimeout(() => setLocation("/login"), 2500);
    return () => window.clearTimeout(timeout);
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-4 px-6">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
            <Activity className="h-5 w-5" />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight">VeriHealth</span>
        </div>
        <div className="mx-auto h-16 w-16 rounded-2xl bg-red-100 dark:bg-red-950 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">OAuth Sign-In Unavailable</h1>
        <p className="text-muted-foreground">
          This deployment only supports email and password sign-in right now. Redirecting you to login.
        </p>
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        <Button
          onClick={() => setLocation("/login")}
          className="w-full"
          data-testid="button-back-to-login-error"
        >
          Go to Login
        </Button>
      </div>
    </div>
  );
}
