import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { vasLogRows } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensureSeeded();
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "unmatched%";

  const rows = await db
    .select()
    .from(vasLogRows)
    .where(sql`${vasLogRows.matchStatus} like ${status}`)
    .orderBy(vasLogRows.sourceRow);

  const header = [
    "SOURCE ROW",
    "DATE",
    "SERVICE PARTNER",
    "SERVICE ID",
    "PRICE POINT",
    "PRODUCT ID",
    "PRODUCT NAME",
    "TRANSACTION",
    "COUNT",
    "REVENUE",
    "REVIEW REASON",
  ];

  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.sourceRow,
        r.logDate ?? r.rawDate,
        r.servicePartner,
        r.serviceId,
        r.pricePoint,
        r.productId,
        r.productName,
        r.transaction,
        r.countValue ?? "",
        r.revenueValue ?? "",
        r.issues,
      ]
        .map(escape)
        .join(",")
    ),
  ].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="BRICCS_Unmatched_Records_${status.replace(/[^a-z_]/gi, "")}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
