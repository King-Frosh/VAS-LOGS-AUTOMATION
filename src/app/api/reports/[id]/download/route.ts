import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { partnerReports, partners, reportBatches } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { validateAttachment, readReportFile, WORKSHEET_NAME } from "@/lib/report";
import { writeAudit } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await ensureSeeded();
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const reportId = Number(id);
  if (!reportId) {
    return NextResponse.json({ error: "Invalid report reference." }, { status: 400 });
  }

  const [report] = await db.select().from(partnerReports).where(eq(partnerReports.id, reportId)).limit(1);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const attachment = await validateAttachment(report.filePath);
  if (!attachment.ok) {
    return NextResponse.json(
      { error: `Workbook unavailable: ${attachment.error ?? "invalid attachment"}` },
      { status: 410 }
    );
  }

  const buf = await readReportFile(report.filePath);
  if (!buf) {
    return NextResponse.json({ error: "Workbook could not be read from private storage." }, { status: 404 });
  }

  const [partner] = await db.select().from(partners).where(eq(partners.id, report.partnerId)).limit(1);
  const [batch] = await db.select().from(reportBatches).where(eq(reportBatches.id, report.batchId)).limit(1);

  await writeAudit({
    actorEmail: user.email,
    actorRole: user.role,
    action: "REPORT_DOWNLOADED",
    entity: "partner_reports",
    entityId: report.id,
    detail: `${report.filename} — ${partner?.name ?? "—"} · ${report.serviceName} (${batch?.startDate ?? ""} → ${batch?.endDate ?? ""})`,
  });

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${report.filename}"`,
      "Content-Length": String(buf.byteLength),
      "X-Worksheet-Name": WORKSHEET_NAME,
      "Cache-Control": "private, no-store",
    },
  });
}
