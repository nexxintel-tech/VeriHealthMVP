import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data, error } = await supabase
    .from("health_readings")
    .select("id, user_id, type, value, unit, source, recorded_at, created_at, updated_at, metadata")
    .limit(1);

  if (error) {
    throw error;
  }

  const row = data?.[0];
  if (!row) {
    console.log("No rows found in health_readings");
    return;
  }

  if (typeof row.id !== "string") {
    throw new Error("Expected id to be UUID string");
  }

  if (row.value !== null && typeof row.value !== "number" && typeof row.value !== "string") {
    throw new Error("Expected value to be nullable numeric");
  }

  console.log("health_readings sanity check passed", {
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    value: row.value,
    unit: row.unit,
  });
}

main().catch((err) => {
  console.error("health_readings sanity check failed:", err);
  process.exit(1);
});
