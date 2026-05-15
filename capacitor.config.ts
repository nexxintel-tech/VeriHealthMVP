type CapacitorConfig = {
  appId: string;
  appName: string;
  webDir: string;
  server?: {
    url?: string;
    cleartext?: boolean;
  };
};

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

const serverUrl = normalizeUrl(
  process.env.CAPACITOR_SERVER_URL?.trim() ||
    process.env.VITE_PATIENT_APP_URL?.trim() ||
    "https://verihealthapp.fulscann.com",
);

const config: CapacitorConfig = {
  appId: "com.fulscann.verihealthapp",
  appName: "VeriHealth",
  webDir: "dist/public",
  server: {
    url: serverUrl,
    cleartext: false,
  },
};

export default config;
