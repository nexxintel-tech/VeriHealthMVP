import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  isAuthenticated,
  getUser,
  getAuthToken,
  clearAuth,
  getRecentSessionValidation,
  setRecentSessionValidation,
} from "@/lib/auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Array<'clinician' | 'admin' | 'institution_admin' | 'patient'>;
}

type UserRole = 'clinician' | 'admin' | 'institution_admin' | 'patient';

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [, setLocation] = useLocation();
  const [roleChecked, setRoleChecked] = useState(false);

  useEffect(() => {
    setRoleChecked(false);

    if (!isAuthenticated()) {
      setLocation("/login");
      return;
    }

    const user = getUser();
    const token = getAuthToken();

    const applyRoleRouting = (role: UserRole) => {
      if (role === 'patient' && (!allowedRoles || !allowedRoles.includes('patient'))) {
        setLocation("/patient");
        return;
      }

      if (allowedRoles && !allowedRoles.includes(role)) {
        setLocation(role === 'patient' ? "/patient" : "/");
        return;
      }

      setRoleChecked(true);
    };

    if (user && token) {
      const cachedRole = getRecentSessionValidation(token);
      if (cachedRole) {
        applyRoleRouting(cachedRole);
        return;
      }

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

          setRecentSessionValidation(token, data.role);
          applyRoleRouting(data.role);
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

  return <>{children}</>;
}
