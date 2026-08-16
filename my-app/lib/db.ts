import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

type GlobalWithPgPool = typeof globalThis & {
  __rentalPgPool?: Pool;
};

const globalForPg = globalThis as GlobalWithPgPool;

function getDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is not configured");
  }

  return value;
}

function getPoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX?.trim();
  if (!raw) return 10;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new Error("DATABASE_POOL_MAX must be an integer between 1 and 50");
  }

  return parsed;
}

function createPool(): Pool {
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: getPoolMax(),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "rental-p2p-web",
  });

  pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error", error);
  });

  return pool;
}

export function getDbPool(): Pool {
  if (!globalForPg.__rentalPgPool) {
    globalForPg.__rentalPgPool = createPool();
  }

  return globalForPg.__rentalPgPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<T>> {
  return getDbPool().query<T>(text, [...values]);
}

export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDbPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
