import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn(
    "DATABASE_URL not set. Postgres connection will not be established. Using in-memory storage.",
  );
}

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

let dbReadyResolve: () => void;
export const dbReady = new Promise<void>((resolve) => {
  dbReadyResolve = resolve;
});

const createDb = () => {
  if (pool) {
    dbReadyResolve();
    return drizzle(pool, { schema });
  } else {
    console.log("Using PGLite for local persistence...");
    const isTest = process.env.NODE_ENV === 'test';
    const client = new PGlite(isTest ? "memory://" : "./.data");
    const db = drizzlePglite(client, { schema });
    // Run migrations on startup for PGLite
    (async () => {
        try {
            const migrationsFolder = path.join(__dirname, "../migrations");
            console.log("Running migrations from:", migrationsFolder);
            await migratePglite(db, { migrationsFolder });
            console.log("Migrations applied successfully!");
        } catch (e) {
            console.error("Failed to apply migrations:", e);
        } finally {
            dbReadyResolve();
        }
    })();
    return db;
  }
}

export const db = createDb();
