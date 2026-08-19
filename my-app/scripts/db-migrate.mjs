import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const args = new Set(process.argv.slice(2));
const mode = args.has("--status") ? "status" : args.has("--bootstrap") ? "bootstrap" : "migrate";
const rootDir = process.cwd();
const migrationsDir = path.resolve(
  rootDir,
  process.env.DB_MIGRATIONS_DIR?.trim() || "docs/migrations",
);
const baselinePath = path.resolve(
  rootDir,
  process.env.DB_BASELINE_PATH?.trim() || "docs/database-schema.sql",
);
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  console.error("[db:migrate] DATABASE_URL is not configured.");
  process.exit(1);
}

function checksum(content) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

function stripOuterTransaction(sql, filename) {
  const lines = sql.replace(/\r\n/g, "\n").split("\n");
  const significant = [];

  for (let index = 0; index < lines.length; index += 1) {
    const value = lines[index].trim();
    if (!value || value.startsWith("--")) continue;
    significant.push(index);
  }

  if (significant.length === 0) return "";

  const firstIndex = significant[0];
  const lastIndex = significant.at(-1);
  const first = lines[firstIndex].trim();
  const last = lines[lastIndex].trim();
  const hasBegin = /^BEGIN\s*;$/i.test(first);
  const hasCommit = /^COMMIT\s*;$/i.test(last);

  if (hasBegin !== hasCommit) {
    throw new Error(
      `${filename} must contain both outer BEGIN; and COMMIT; or neither`,
    );
  }

  if (hasBegin && hasCommit) {
    lines[firstIndex] = "";
    lines[lastIndex] = "";
  }

  return lines.join("\n").trim();
}

async function relationExists(client, relationName) {
  const result = await client.query(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [`public.${relationName}`],
  );
  return result.rows[0]?.exists === true;
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function loadMigrations() {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  return Promise.all(
    files.map(async (filename) => {
      const filePath = path.join(migrationsDir, filename);
      const sql = await readFile(filePath, "utf8");
      return {
        filename,
        sql,
        checksum: checksum(sql),
      };
    }),
  );
}

async function applyBaseline(client) {
  const hasUsers = await relationExists(client, "users");
  if (hasUsers) return false;

  if (mode !== "bootstrap") {
    throw new Error(
      "Database baseline is missing. Run `npm run db:bootstrap` once for a brand-new database.",
    );
  }

  const baselineSql = await readFile(baselinePath, "utf8");
  console.log(`[db:migrate] Applying baseline ${path.relative(rootDir, baselinePath)}...`);
  await client.query(baselineSql);
  console.log("[db:migrate] Baseline applied.");
  return true;
}

async function main() {
  const client = new Client({
    connectionString: databaseUrl,
    application_name: "borow-borow-db-migrate",
  });

  await client.connect();
  let locked = false;

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [
      "borow-borow:database-migrations:v1",
    ]);
    locked = true;

    await applyBaseline(client);
    await ensureLedger(client);

    const migrations = await loadMigrations();
    const appliedResult = await client.query(
      "SELECT filename, checksum, applied_at FROM schema_migrations ORDER BY filename",
    );
    const applied = new Map(
      appliedResult.rows.map((row) => [row.filename, row]),
    );

    let pending = 0;

    for (const migration of migrations) {
      const existing = applied.get(migration.filename);

      if (existing) {
        if (existing.checksum !== migration.checksum) {
          throw new Error(
            `Migration checksum mismatch for ${migration.filename}. Never edit an applied migration; add a new migration instead.`,
          );
        }

        console.log(`[db:migrate] ✓ ${migration.filename} already applied`);
        continue;
      }

      pending += 1;

      if (mode === "status") {
        console.log(`[db:migrate] • ${migration.filename} pending`);
        continue;
      }

      const body = stripOuterTransaction(migration.sql, migration.filename);
      console.log(`[db:migrate] Applying ${migration.filename}...`);

      await client.query("BEGIN");
      try {
        if (body) await client.query(body);
        await client.query(
          "INSERT INTO schema_migrations(filename, checksum) VALUES ($1, $2)",
          [migration.filename, migration.checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }

      console.log(`[db:migrate] ✓ ${migration.filename}`);
    }

    if (mode === "status") {
      const totalApplied = migrations.length - pending;
      console.log(
        `[db:migrate] Status: ${totalApplied}/${migrations.length} migrations applied, ${pending} pending.`,
      );
      return;
    }

    console.log(
      `[db:migrate] Complete. ${pending} migration${pending === 1 ? "" : "s"} applied.`,
    );
  } finally {
    if (locked) {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [
        "borow-borow:database-migrations:v1",
      ]);
    }
    await client.end();
  }
}

main().catch((error) => {
  console.error(`[db:migrate] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
