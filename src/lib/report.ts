import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { and, between, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  vasLogRows,
  partners,
  services,
  reportBatches,
  partnerReports,
  type Partner,
  type Service,
} from "@/db/schema";
import { REQUIRED_HEADERS } from "./ingest";
import { sanitizeFilename, slugSegment, safeCellValue } from "./security";

export const STORAGE_ROOT = path.join(process.cwd(), "storage");
export const UPLOAD_DIR = path.join(STORAGE_ROOT, "uploads");
export const REPORT_DIR = path.join(STORAGE_ROOT, "reports");
export const WORKSHEET_NAME = "Unreconciled Logs";

export async function ensureStorage() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });
}

export function reportFilename(partner: Partner, service: Service, start: string, end: string) {
  return sanitizeFilename(
    `BRICCS_VAS_Report_${slugSegment(partner.code)}_${slugSegment(service.serviceName)}_${start}_${end}.xlsx`
  );
}

export type GeneratedReport = {
  partner: Partner;
  service: Service;
  filename: string;
  filePath: string;
  fileSize: number;
  rowCount: number;
  countTotal: number;
  revenueTotal: string;
};

type SourceRow = {
  id: number;
  sourceRow: number;
  logDate: string | null;
  servicePartner: string;
  serviceId: string;
  pricePoint: string;
  productId: string;
  productName: string;
  transaction: string;
  countValue: number | null;
  revenueValue: string | null;
};

/**
 * Builds the single-worksheet workbook required by the specification:
 * exactly one worksheet named `Unreconciled Logs`, the nine original headers
 * in their original order, identifiers preserved as text.
 */
export async function writeWorkbook(rows: SourceRow[], outPath: string): Promise<number> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BRICCS VAS Revenue Console";
  wb.company = "BRICCS International Ideal Limited";
  const ws = wb.addWorksheet(WORKSHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
    properties: { defaultRowHeight: 16 },
  });

  const columns = [
    { header: "DATE", key: "DATE", width: 13 },
    { header: "SERVICE PARTNER", key: "SERVICE PARTNER", width: 34 },
    { header: "SERVICE ID", key: "SERVICE ID", width: 14 },
    { header: "PRICE POINT", key: "PRICE POINT", width: 12 },
    { header: "PRODUCT ID", key: "PRODUCT ID", width: 16 },
    { header: "PRODUCT NAME", key: "PRODUCT NAME", width: 28 },
    { header: "TRANSACTION", key: "TRANSACTION", width: 14 },
    { header: "COUNT", key: "COUNT", width: 11 },
    { header: "REVENUE", key: "REVENUE", width: 15 },
  ];
  ws.columns = columns;

  const headerRow = ws.getRow(1);
  REQUIRED_HEADERS.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: "FF12161A" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0D8C8" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FF12161A" } } };
  });
  headerRow.height = 20;

  for (const r of rows) {
    const row = ws.addRow({
      DATE: safeCellValue(r.logDate ?? ""),
      "SERVICE PARTNER": safeCellValue(r.servicePartner),
      "SERVICE ID": safeCellValue(String(r.serviceId ?? "")),
      "PRICE POINT": safeCellValue(String(r.pricePoint ?? "")),
      "PRODUCT ID": safeCellValue(String(r.productId ?? "")),
      "PRODUCT NAME": safeCellValue(r.productName),
      TRANSACTION: safeCellValue(r.transaction),
      COUNT: r.countValue ?? 0,
      REVENUE: Number(r.revenueValue ?? 0),
    });
    // Identifiers stay text so leading zeroes survive.
    row.getCell("SERVICE ID").numFmt = "@";
    row.getCell("PRODUCT ID").numFmt = "@";
    row.getCell("PRICE POINT").numFmt = "@";
    row.getCell("DATE").numFmt = "@";
    row.getCell("COUNT").numFmt = "#,##0";
    row.getCell("REVENUE").numFmt = "#,##0.00";
    row.alignment = { vertical: "middle" };
  }

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: REQUIRED_HEADERS.length },
  };

  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, buf);
  return buf.byteLength;
}

export type BatchResult = {
  batchId: number;
  reports: GeneratedReport[];
  stats: {
    sourceRows: number;
    matchedRows: number;
    unmatchedRows: number;
    invalidRows: number;
    matchedCount: number;
    matchedRevenue: number;
    unmatchedCount: number;
    unmatchedRevenue: number;
    balanced: boolean;
  };
};

/** Generates one workbook per eligible partner-service combination. */
export async function generateBatch(params: {
  startDate: string;
  endDate: string;
  frequency: string;
  label?: string;
  createdBy?: number;
  createdByName?: string;
  uploadIds?: number[];
}): Promise<BatchResult> {
  await ensureStorage();

  const conditions = [
    sql`${vasLogRows.logDate} >= ${params.startDate}`,
    sql`${vasLogRows.logDate} <= ${params.endDate}`,
    eq(vasLogRows.matchStatus, "matched"),
    sql`${vasLogRows.partnerId} IS NOT NULL`,
    sql`${vasLogRows.serviceIdRef} IS NOT NULL`,
  ];
  if (params.uploadIds?.length) {
    conditions.push(inArray(vasLogRows.uploadId, params.uploadIds));
  }

  const matched = await db
    .select()
    .from(vasLogRows)
    .where(and(...conditions));

  const allInRange = await db
    .select()
    .from(vasLogRows)
    .where(and(
      sql`${vasLogRows.logDate} >= ${params.startDate}`,
      sql`${vasLogRows.logDate} <= ${params.endDate}`,
      params.uploadIds?.length ? inArray(vasLogRows.uploadId, params.uploadIds) : sql`true`
    ));

  const sumCount = (rows: SourceRow[]) =>
    rows.reduce((a, r) => a + (r.countValue ?? 0), 0);
  const sumRevenue = (rows: SourceRow[]) =>
    rows.reduce((a, r) => a + Number(r.revenueValue ?? 0), 0);

  const invalidRows = allInRange.filter((r) => (r as { matchStatus: string }).matchStatus === "invalid");
  const unmatchedRows = allInRange.filter(
    (r) => (r as { matchStatus: string }).matchStatus !== "matched" && (r as { matchStatus: string }).matchStatus !== "invalid"
  );

  const [batch] = await db
    .insert(reportBatches)
    .values({
      label:
        params.label ??
        `Unreconciled logs ${params.startDate} → ${params.endDate}`,
      startDate: params.startDate,
      endDate: params.endDate,
      frequency: params.frequency,
      status: "Processing",
      createdBy: params.createdBy ?? null,
      createdByName: params.createdByName ?? "",
    })
    .returning();

  // group by partner + service
  const groups = new Map<string, SourceRow[]>();
  for (const row of matched) {
    const key = `${row.partnerId}:${row.serviceIdRef}`;
    groups.set(key, [...(groups.get(key) ?? []), row as unknown as SourceRow]);
  }

  const partnerIds = [...new Set([...groups.keys()].map((k) => Number(k.split(":")[0])))];
  const serviceIds = [...new Set([...groups.keys()].map((k) => Number(k.split(":")[1])))];
  const partnerRows = partnerIds.length
    ? await db.select().from(partners).where(inArray(partners.id, partnerIds))
    : [];
  const serviceRows = serviceIds.length
    ? await db.select().from(services).where(inArray(services.id, serviceIds))
    : [];
  const partnerById = new Map(partnerRows.map((p) => [p.id, p]));
  const serviceById = new Map(serviceRows.map((s) => [s.id, s]));

  const reports: GeneratedReport[] = [];

  for (const [key, rows] of groups) {
    const [pid, sid] = key.split(":").map(Number);
    const partner = partnerById.get(pid);
    const service = serviceById.get(sid);
    if (!partner || !service) continue;

    // Sorted by source row so legitimate repeated records are preserved verbatim.
    const sorted = [...rows].sort((a, b) => a.sourceRow - b.sourceRow);
    const filename = reportFilename(partner, service, params.startDate, params.endDate);
    const filePath = path.join(REPORT_DIR, filename);
    const fileSize = await writeWorkbook(sorted, filePath);

    const countTotal = sumCount(sorted);
    const revenueTotal = sumRevenue(sorted).toFixed(2);

    await db.insert(partnerReports).values({
      batchId: batch.id,
      partnerId: partner.id,
      serviceId: service.id,
      serviceName: service.serviceName,
      partnerCode: partner.code,
      filename,
      filePath,
      fileSize,
      rowCount: sorted.length,
      countTotal,
      revenueTotal,
      status: "Ready to Send",
    });

    reports.push({
      partner,
      service,
      filename,
      filePath,
      fileSize,
      rowCount: sorted.length,
      countTotal,
      revenueTotal,
    });
  }

  const matchedCount = sumCount(matched as unknown as SourceRow[]);
  const matchedRevenue = sumRevenue(matched as unknown as SourceRow[]);
  const unmatchedCount = sumCount(unmatchedRows as unknown as SourceRow[]);
  const unmatchedRevenue = sumRevenue(unmatchedRows as unknown as SourceRow[]);
  const validSourceCount = matchedCount + unmatchedCount;
  const validSourceRevenue = matchedRevenue + unmatchedRevenue;
  const balanced =
    Math.abs(validSourceRevenue - (matchedRevenue + unmatchedRevenue)) < 0.005 &&
    validSourceCount === matchedCount + unmatchedCount;

  await db
    .update(reportBatches)
    .set({
      status: reports.length ? "Ready for Review" : "Ready for Review",
      sourceRows: allInRange.length,
      matchedRows: matched.length,
      unmatchedRows: unmatchedRows.length,
      invalidRows: invalidRows.length,
      matchedCount,
      matchedRevenue: matchedRevenue.toFixed(2),
      unmatchedCount,
      unmatchedRevenue: unmatchedRevenue.toFixed(2),
      balanced,
      completedAt: new Date(),
    })
    .where(eq(reportBatches.id, batch.id));

  return {
    batchId: batch.id,
    reports,
    stats: {
      sourceRows: allInRange.length,
      matchedRows: matched.length,
      unmatchedRows: unmatchedRows.length,
      invalidRows: invalidRows.length,
      matchedCount,
      matchedRevenue,
      unmatchedCount,
      unmatchedRevenue,
      balanced,
    },
  };
}

export async function readReportFile(filePath: string): Promise<Buffer | null> {
  try {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(STORAGE_ROOT)) return null;
    return await fs.readFile(resolved);
  } catch {
    return null;
  }
}

/** Validates that a generated workbook still exists and is a readable .xlsx. */
export async function validateAttachment(filePath: string): Promise<{
  ok: boolean;
  bytes: number;
  worksheetName?: string;
  error?: string;
}> {
  try {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(STORAGE_ROOT)) {
      return { ok: false, bytes: 0, error: "Attachment path is outside private storage." };
    }
    const stat = await fs.stat(resolved);
    const buf = await fs.readFile(resolved);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) return { ok: false, bytes: stat.size, error: "Workbook contains no worksheet." };
    if (ws.name !== WORKSHEET_NAME) {
      return {
        ok: false,
        bytes: stat.size,
        worksheetName: ws.name,
        error: `Worksheet is named "${ws.name}" — required name is "${WORKSHEET_NAME}".`,
      };
    }
    if (wb.worksheets.length !== 1) {
      return {
        ok: false,
        bytes: stat.size,
        worksheetName: ws.name,
        error: `Workbook has ${wb.worksheets.length} worksheets — exactly one is permitted.`,
      };
    }
    return { ok: true, bytes: stat.size, worksheetName: ws.name };
  } catch (err) {
    return { ok: false, bytes: 0, error: `Attachment could not be read: ${(err as Error).message}` };
  }
}

export { between };
