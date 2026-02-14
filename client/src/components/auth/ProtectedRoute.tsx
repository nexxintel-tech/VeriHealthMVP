import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { isAuthenticated, getUser, getAuthToken, clearAuth } from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'clinician' | 'admin' | 'institution_admin' | 'patient'>;
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [location, setLocation] = useLocation();
  const [roleChecked, setRoleChecked] = useState(false);

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

          if (data.role === 'patient' && (!allowedRoles || !allowedRoles.includes('patient'))) {
            setLocation("/patient");
            return;
          }

          if (allowedRoles && !allowedRoles.includes(data.role)) {
            if (data.role === 'patient') {
              setLocation("/patient");
            } else {
              setLocation("/");
            }
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
  }, [setLocation, allowedRoles, location]);

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

  return <>{children}</>;
}
