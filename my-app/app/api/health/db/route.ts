import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type HealthRow = {
  database: string;
  server_time: Date;
};

export async function GET() {
  const startedAt = performance.now();

  try {
    const result = await query<HealthRow>(
      "SELECT current_database() AS database, now() AS server_time",
    );
    const row = result.rows[0];

    return Response.json(
      {
        status: "ok",
        database: row?.database ?? null,
        serverTime: row?.server_time ?? null,
        latencyMs: Math.round(performance.now() - startedAt),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Database health check failed", error);

    return Response.json(
      {
        status: "error",
        error: "Database unavailable",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }
}
