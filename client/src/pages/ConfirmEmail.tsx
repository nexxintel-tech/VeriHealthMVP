import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { XCircle, Loader2, Activity } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function ConfirmEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStatus("error");
      setMessage(
        "Email confirmation is not active on this deployment. Go to login and sign in with the account you created.",
      );
    }, 300);

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <AuthLayout
      panelQuote="Every confirmed account is a step closer to safer, more connected patient care."
      panelAuthor="VeriHealth Platform"
    >
      <div className="space-y-7">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-400 to-indigo-600 flex items-center justify-center text-white shadow-md">
            <Activity className="h-5 w-5" />
          </div>
          <span className="font-heading font-bold text-xl tracking-tight">VeriHealth</span>
        </div>

        <div className="flex flex-col items-center justify-center py-8 space-y-5">
          {status === "loading" && (
            <div className="h-20 w-20 rounded-full bg-teal-50 flex items-center justify-center">
              <Loader2 className="h-9 w-9 text-teal-500 animate-spin" />
            </div>
          )}
          {status === "error" && (
            <div className="h-20 w-20 rounded-full bg-red-50 flex items-center justify-center">
              <XCircle className="h-9 w-9 text-red-500" />
            </div>
          )}

          <div className="text-center space-y-2">
            <h1 className="text-2xl font-heading font-bold tracking-tight text-foreground">
              {status === "loading" && "Checking your link..."}
              {status === "error" && "Email Confirmation Unavailable"}
            </h1>
            <p className="text-sm text-muted-foreground max-w-xs">{message}</p>
          </div>
        </div>

        {status === "error" && (
          <div className="space-y-3">
            <Button
              onClick={() => setLocation("/login")}
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-400 to-indigo-600 text-white hover:from-teal-500 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all duration-200 rounded-xl"
              data-testid="button-goto-login"
            >
              Go to Login
            </Button>
            <Button
              onClick={() => setLocation("/register")}
              variant="outline"
              className="w-full h-12 rounded-xl"
              data-testid="button-goto-register"
            >
              Create Another Account
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
