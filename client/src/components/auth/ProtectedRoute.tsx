import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { isAuthenticated, getUser, getAuthToken, clearAuth } from "@/lib/auth";
import { Activity, AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'clinician' | 'admin' | 'institution_admin' | 'patient'>;
}

function PatientBlockedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8" data-testid="screen-patient-blocked">
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
            data-testid="link-go-to-patient-app"
          >
            Go to VeriHealth App
            <ExternalLink className="h-4 w-4" />
          </a>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              clearAuth();
              window.location.href = "/login";
            }}
            data-testid="button-sign-out-blocked"
          >
            Sign out
          </Button>
        </div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          <span>VeriHealth</span>
        </div>
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const [roleChecked, setRoleChecked] = useState(false);
  const [isPatient, setIsPatient] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      setLocation("/login");
      return;
    }

    const user = getUser();
    const token = getAuthToken();

    if (user && token) {
      fetch('/api/session/check', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
        .then(res => {
          if (!res.ok) {
            clearAuth();
            setLocation("/login");
            return null;
          }
          return res.json();
        })
        .then(data => {
          if (!data) return;

          if (data.role === 'patient') {
            setIsPatient(true);
            setRoleChecked(true);
            return;
          }

          if (allowedRoles && !allowedRoles.includes(data.role)) {
            setLocation("/");
            return;
          }

          setRoleChecked(true);
        })
        .catch(() => {
          clearAuth();
          setLocation("/login");
        });
    } else {
      setRoleChecked(true);
    }
  }, [setLocation, allowedRoles]);

  if (!isAuthenticated()) {
    return null;
  }

  if (!roleChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isPatient) {
    return <PatientBlockedScreen />;
  }

  return <>{children}</>;
}
