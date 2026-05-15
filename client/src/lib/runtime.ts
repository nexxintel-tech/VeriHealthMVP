const dashboardUrl = import.meta.env.VITE_DASHBOARD_URL?.trim() || "";
const patientAppUrl = import.meta.env.VITE_PATIENT_APP_URL?.trim() || "";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function getHostname(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

export function isPatientAppHost(): boolean {
  if (typeof window === "undefined") return false;
  const configuredHost = getHostname(patientAppUrl);
  if (configuredHost) return window.location.hostname === configuredHost;
  return window.location.hostname === "verihealthapp.fulscann.com";
}

export function getPatientAppUrl(): string {
  return normalizeBaseUrl(patientAppUrl);
}

export function getDashboardUrl(): string {
  return normalizeBaseUrl(dashboardUrl);
}

export function getRoleHomePath(role: string): string {
  return role === "patient" ? "/patient" : "/";
}

export function getRoleHomeUrl(role: string): string {
  const path = getRoleHomePath(role);
  const targetBase = role === "patient" ? getPatientAppUrl() : getDashboardUrl();
  if (!targetBase) return path;
  return `${targetBase}${path}`;
}

export function navigateToRoleHome(role: string, setLocation?: (path: string) => void) {
  const target = getRoleHomeUrl(role);
  const isAbsolute = /^https?:\/\//.test(target);

  if (isAbsolute && typeof window !== "undefined") {
    window.location.assign(target);
    return;
  }

  if (setLocation) {
    setLocation(target);
    return;
  }

  if (typeof window !== "undefined") {
    window.location.assign(target);
  }
}

export function getAuthPath(path: "/login" | "/register" | "/forgot-password" | "/reset-password" | "/confirm-email" | "/auth/callback"): string {
  return path;
}

export function getDependentRoute(patientId: string | null): string {
  if (!patientId) return "/patient";
  return `/patient?dependent=${encodeURIComponent(patientId)}`;
}
