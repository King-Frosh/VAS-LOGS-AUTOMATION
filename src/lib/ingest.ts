import * as XLSX from "xlsx";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vasLogRows, partners, services, uploads } from "@/db/schema";

/** The nine required MTN source headers, in their original order. */
export const REQUIRED_HEADERS = [
  "DATE",
  "SERVICE PARTNER",
  "SERVICE ID",
  "PRICE POINT",
  "PRODUCT ID",
  "PRODUCT NAME",
  "TRANSACTION",
  "COUNT",
  "REVENUE",
] as const;

export type HeaderIssue = {
  severity: "error" | "warning";
  message: string;
};

export type ParsedRow = {
  sourceRow: number;
  logDate: string | null;
  rawDate: string;
  servicePartner: string;
  serviceId: string;
  pricePoint: string;
  productId: string;
  productName: string;
  transaction: string;
  countValue: number | null;
  revenueValue: string | null;
  partnerId: number | null;
  serviceIdRef: number | null;
  matchStatus: string;
  issues: string;
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().replace(/\s+/g, " ");

export function parseWorkbookBuffer(buf: Buffer, filename: string): {
  rows: Record<string, unknown>[];
  headerIssues: HeaderIssue[];
  order: string[];
} {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (!["xlsx", "xls", "csv"].includes(ext)) {
    return {
      rows: [],
      headerIssues: [
        {
          severity: "error",
          message: `Unsupported file extension ".${ext}". Only .xlsx, .xls and .csv are accepted.`,
        },
      ],
      order: [],
    };
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buf, { type: "buffer", cellDates: true, raw: false });
  } catch (err) {
    return {
      rows: [],
      headerIssues: [
        {
          severity: "error",
          message: `The file could not be read as a spreadsheet: ${(err as Error).message}`,
        },
      ],
      order: [],
    };
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      rows: [],
      headerIssues: [{ severity: "error", message: "The workbook contains no worksheets." }],
      order: [],
    };
  }
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  if (matrix.length === 0) {
    return {
      rows: [],
      headerIssues: [{ severity: "error", message: "The first worksheet is empty." }],
      order: [],
    };
  }

  const rawHeader = (matrix[0] as unknown[]).map((h) => String(h ?? "").trim());
  const headerIssues = validateHeaders(rawHeader);
  const order = rawHeader;

  // Map required header -> column index (case/whitespace tolerant).
  const colOf = new Map<string, number>();
  rawHeader.forEach((h, i) => {
    const key = norm(h);
    if (!colOf.has(key)) colOf.set(key, i);
  });

  const rows: Record<string, unknown>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const line = matrix[r] as unknown[];
    if (!line || line.every((c) => String(c ?? "").trim() === "")) continue;
    const obj: Record<string, unknown> = { __row: r + 1 };
    for (const header of REQUIRED_HEADERS) {
      const idx = colOf.get(norm(header));
      obj[header] = idx === undefined ? "" : line[idx];
    }
    rows.push(obj);
  }

  return { rows, headerIssues, order };
}

export function validateHeaders(rawHeader: string[]): HeaderIssue[] {
  const issues: HeaderIssue[] = [];
  const normalised = rawHeader.map(norm).filter((h) => h !== "");

  for (const required of REQUIRED_HEADERS) {
    const matches = normalised.filter((h) => h === norm(required));
    if (matches.length === 0) {
      issues.push({ severity: "error", message: `Required column "${required}" is missing.` });
    } else if (matches.length > 1) {
      issues.push({
        severity: "error",
        message: `Required column "${required}" appears ${matches.length} times and is ambiguous.`,
      });
    }
  }

  const extra = normalised.filter((h) => !REQUIRED_HEADERS.some((r) => norm(r) === h));
  if (extra.length) {
    issues.push({
      severity: "warning",
      message: `${extra.length} additional column(s) ignored: ${extra.slice(0, 6).join(", ")}${extra.length > 6 ? "…" : ""}`,
    });
  }

  // Order check — spec requires the nine headers in their original order.
  const foundOrder = normalised.filter((h) => REQUIRED_HEADERS.some((r) => norm(r) === h));
  const expected = REQUIRED_HEADERS.map((r) => norm(r));
  if (
    issues.every((i) => i.severity !== "error") &&
    foundOrder.length === expected.length &&
    foundOrder.some((h, i) => h !== expected[i])
  ) {
    issues.push({
      severity: "warning",
      message: "Required columns are present but not in the original MTN order. Reports will use the original order.",
    });
  }

  return issues;
}

function excelDateToISO(value: unknown): { iso: string | null; raw: string } {
  if (value === null || value === undefined) return { iso: null, raw: "" };
  const raw = String(value).trim();
  if (raw === "") return { iso: null, raw: "" };

  if (value instanceof Date && !isNaN(value.getTime())) {
    return { iso: value.toISOString().slice(0, 10), raw };
  }

  // Excel serial number
  if (typeof value === "number" && value > 20000 && value < 80000) {
    const ms = Math.round((value - 25569) * 86400 * 1000);
    return { iso: new Date(ms).toISOString().slice(0, 10), raw };
  }

  const isoMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return {
      iso: `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`,
      raw,
    };
  }
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    return { iso: `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`, raw };
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return { iso: parsed.toISOString().slice(0, 10), raw };
  return { iso: null, raw };
}

function toNumber(value: unknown): number | null {
  const n = Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Builds match lookups from the Partner Register + manual service mapping register. */
export async function buildMatchers() {
  const allPartners = await db.select().from(partners);
  const allServices = await db.select().from(services);

  const byName = new Map<string, number[]>();
  const byCode = new Map<string, number[]>();
  for (const p of allPartners) {
    const n = norm(p.name);
    byName.set(n, [...(byName.get(n) ?? []), p.id]);
    byCode.set(norm(p.code), [...(byCode.get(norm(p.code)) ?? []), p.id]);
  }
  const byServiceId = new Map<string, typeof allServices[number]>();
  const byServiceName = new Map<string, typeof allServices[number][]>();
  for (const s of allServices) {
    if (!byServiceId.has(norm(s.serviceId))) byServiceId.set(norm(s.serviceId), s);
    const n = norm(s.serviceName);
    byServiceName.set(n, [...(byServiceName.get(n) ?? []), s]);
  }
  return { allPartners, allServices, byName, byCode, byServiceId, byServiceName };
}

type Matchers = Awaited<ReturnType<typeof buildMatchers>>;

export function matchRow(
  obj: Record<string, unknown>,
  m: Matchers
): {
  partnerId: number | null;
  serviceIdRef: number | null;
  matchStatus: string;
  issues: string;
} {
  const partnerRaw = String(obj["SERVICE PARTNER"] ?? "").trim();
  const serviceIdRaw = String(obj["SERVICE ID"] ?? "").trim();
  const productNameRaw = String(obj["PRODUCT NAME"] ?? "").trim();
  const issues: string[] = [];

  // ---- partner: never guess ----
  let partnerId: number | null = null;
  const nameHits = m.byName.get(norm(partnerRaw)) ?? [];
  const codeHits = m.byCode.get(norm(partnerRaw)) ?? [];
  const partnerHits = [...new Set([...nameHits, ...codeHits])];
  if (partnerHits.length === 1) {
    partnerId = partnerHits[0];
  } else if (partnerHits.length > 1) {
    issues.push(
      `"${partnerRaw}" matches more than one partner in the Partner Register. Ambiguous matches are never resolved automatically.`
    );
  } else if (partnerRaw === "") {
    issues.push("SERVICE PARTNER is empty.");
  } else {
    issues.push(`SERVICE PARTNER "${partnerRaw}" is not in the Partner Register.`);
  }

  // ---- service: from the manual mapping register ----
  let serviceIdRef: number | null = null;
  const byId = m.byServiceId.get(norm(serviceIdRaw));
  const byNameHits = m.byServiceName.get(norm(productNameRaw)) ?? [];
  const svcHits = [...(byId ? [byId] : []), ...byNameHits];

  if (svcHits.length === 1) {
    const svc = svcHits[0];
    if (partnerId !== null && svc.partnerId !== partnerId) {
      issues.push(
        `Service "${svc.serviceId} / ${svc.serviceName}" is mapped to a different partner than "${partnerRaw}".`
      );
    } else {
      serviceIdRef = svc.id;
      if (partnerId === null) partnerId = svc.partnerId;
    }
  } else if (svcHits.length > 1) {
    issues.push(
      `Service identifier "${serviceIdRaw || productNameRaw}" is ambiguous across the service mapping register.`
    );
  } else if (serviceIdRaw === "") {
    issues.push("SERVICE ID is empty and PRODUCT NAME does not resolve to a mapped service.");
  } else {
    issues.push(
      `Service ID "${serviceIdRaw}" is not mapped to any partner. Add it under Service Mapping to include it in reports.`
    );
  }

  let matchStatus = "matched";
  if (partnerId === null) matchStatus = "unmatched_partner";
  else if (serviceIdRef === null) matchStatus = "unmatched_service";

  return { partnerId, serviceIdRef, matchStatus, issues: issues.join(" ") };
}

export function normaliseRow(obj: Record<string, unknown>, m: Matchers): ParsedRow {
  const { iso, raw } = excelDateToISO(obj["DATE"]);
  const match = matchRow(obj, m);
  const count = toNumber(obj["COUNT"]);
  const revenue = toNumber(obj["REVENUE"]);
  const issues = [...(match.issues ? [match.issues] : [])];

  if (!iso) issues.push(`DATE "${raw}" could not be interpreted.`);
  if (count === null) issues.push(`COUNT "${String(obj["COUNT"] ?? "")}" is not numeric.`);
  if (revenue === null) issues.push(`REVENUE "${String(obj["REVENUE"] ?? "")}" is not numeric.`);

  const invalid = !iso || count === null || revenue === null;
  return {
    sourceRow: Number(obj.__row ?? 0),
    logDate: iso,
    rawDate: raw,
    servicePartner: String(obj["SERVICE PARTNER"] ?? ""),
    serviceId: String(obj["SERVICE ID"] ?? ""),
    pricePoint: String(obj["PRICE POINT"] ?? ""),
    productId: String(obj["PRODUCT ID"] ?? ""),
    productName: String(obj["PRODUCT NAME"] ?? ""),
    transaction: String(obj["TRANSACTION"] ?? ""),
    countValue: count,
    revenueValue: revenue === null ? null : revenue.toFixed(2),
    partnerId: match.partnerId,
    serviceIdRef: match.serviceIdRef,
    matchStatus: invalid ? "invalid" : match.matchStatus,
    issues: issues.join(" "),
  };
}

export async function loadRowsForUpload(uploadId: number) {
  return db.select().from(vasLogRows).where(eq(vasLogRows.uploadId, uploadId));
}

export { uploads };
