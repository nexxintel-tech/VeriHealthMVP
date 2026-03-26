import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // High-performance settings for Railway + Supabase
  max: 10,                 // Limit max connections to prevent exhausting Supabase limits
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Don't hang forever if the DB is unreachable
  ssl: {
    rejectUnauthorized: false // Required for most cloud providers to connect via SSL
  }
});

export const db = drizzle(pool, { schema });