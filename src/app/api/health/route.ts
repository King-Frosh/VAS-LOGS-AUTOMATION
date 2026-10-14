import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  let dbOk = false;
  let detail = "";
  try {
    await db.execute(sql`select 1`);
    dbOk = true;
    detail = "postgres reachable";
  } catch (err) {
    detail = (err as Error).message.slice(0, 160);
  }

  return NextResponse.json({
    status: dbOk ? "ok" : "degraded",
    service: "BRICCS VAS Revenue Console",
    company: "BRICCS International Ideal Limited",
    checks: {
      database: dbOk ? "connected" : `unavailable — ${detail}`,
      smtp: "configured through Email Settings",
      storage: "private /storage/uploads and /storage/reports",
    },
    timestamp: new Date().toISOString(),
  });
}
