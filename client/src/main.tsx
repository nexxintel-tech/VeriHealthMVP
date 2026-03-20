import { createRoot } from "react-dom/client";
import App from "./App";
import { supabaseConfigError } from "@/lib/supabase";
import "./index.css";

function ConfigurationError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-lg rounded-xl border border-red-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Configuration error</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          The app cannot start because the client-side Supabase environment variables are missing.
        </p>
        <p className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {supabaseConfigError}
        </p>
        <p className="mt-4 text-sm text-slate-600">
          Set <code className="rounded bg-slate-100 px-1 py-0.5">VITE_SUPABASE_URL</code> and
          <code className="ml-1 rounded bg-slate-100 px-1 py-0.5">VITE_SUPABASE_ANON_KEY</code>
          in the deployment environment, then rebuild and republish.
        </p>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  supabaseConfigError ? <ConfigurationError /> : <App />,
);
